import { IVisaType } from '../models/VisaType';

// GST is a fixed 18% and applies ONLY to the service fee, our own margin. Visa fees
// and VFS fees are pass-through government/VFS charges and are never taxed, in any case.
export const GST_RATE = 0.18;

export interface PriceBreakdown {
  adultBase: number;   // visa fee per adult
  adultVfs: number;    // VFS fee per adult
  adultFee: number;    // service fee per adult (optional component)
  childBase: number;
  childVfs: number;
  childFee: number;
}

type PricingFields = Pick<
  IVisaType,
  | 'adultPrice' | 'price' | 'adultVfsFee' | 'adultServiceFee'
  | 'childPrice' | 'childVfsFee' | 'childServiceFee'
  | 'corporateAdultServiceFee' | 'corporateChildServiceFee'
  | 'b2bAdultPrice' | 'b2bChildPrice' | 'b2bAdultVfsFee' | 'b2bChildVfsFee'
  | 'b2bAdultServiceFee' | 'b2bChildServiceFee'
>;

export type PricingTier = 'individual' | 'corporate' | 'b2b_agent';

export function pricingTierOf(user: { accountType?: string; corporateType?: string } | null | undefined): PricingTier {
  if (user?.accountType !== 'corporate') return 'individual';
  return user.corporateType === 'b2b_agent' ? 'b2b_agent' : 'corporate';
}

/**
 * The service fee a tier pays. Unset overrides fall through: B2B -> corporate -> standard.
 * 0 is a real value (the fee is waived), so only null/undefined falls through.
 */
function serviceFeeFor(tier: PricingTier, std?: number, corp?: number, b2b?: number): number {
  if (tier === 'b2b_agent' && b2b != null) return b2b;
  if (tier !== 'individual' && corp != null) return corp;
  return std || 0;
}

// B2B agents have their own full price list; any component left unset uses the standard one.
const b2bOr = (tier: PricingTier, b2b: number | undefined, std: number) => (tier === 'b2b_agent' && b2b != null ? b2b : std);

// Per-traveler pricing = visa fee + VFS fee + service fee. Falls back to legacy single
// price for older visa types. Individual and corporate accounts share the visa and VFS
// fees and differ only by service fee; B2B agents can differ on every component.
export function computeVisaPricing(visaType: PricingFields, tier: PricingTier): PriceBreakdown {
  return {
    adultBase: b2bOr(tier, visaType.b2bAdultPrice, visaType.adultPrice || visaType.price || 0),
    adultVfs: b2bOr(tier, visaType.b2bAdultVfsFee, visaType.adultVfsFee || 0),
    adultFee: serviceFeeFor(tier, visaType.adultServiceFee, visaType.corporateAdultServiceFee, visaType.b2bAdultServiceFee),
    childBase: b2bOr(tier, visaType.b2bChildPrice, visaType.childPrice || 0),
    childVfs: b2bOr(tier, visaType.b2bChildVfsFee, visaType.childVfsFee || 0),
    childFee: serviceFeeFor(tier, visaType.childServiceFee, visaType.corporateChildServiceFee, visaType.b2bChildServiceFee),
  };
}

// Pre-GST order subtotal across all travelers (visa + VFS + service).
export function computeSubtotal(breakdown: PriceBreakdown, numAdults: number, numChildren: number): number {
  return (
    numAdults * (breakdown.adultBase + breakdown.adultVfs + breakdown.adultFee) +
    numChildren * (breakdown.childBase + breakdown.childVfs + breakdown.childFee)
  );
}

// Total service fee across all travelers, the only GST-taxable component.
export function computeServiceFeeTotal(breakdown: PriceBreakdown, numAdults: number, numChildren: number): number {
  return numAdults * breakdown.adultFee + numChildren * breakdown.childFee;
}

// GST = 18% of the service fee total only. Visa and VFS fees are untaxed.
export function computeGst(breakdown: PriceBreakdown, numAdults: number, numChildren: number): number {
  return Math.round(computeServiceFeeTotal(breakdown, numAdults, numChildren) * GST_RATE);
}

// Final payable amount: subtotal + GST (GST charged on the service fee only).
export function computePaymentAmount(breakdown: PriceBreakdown, numAdults: number, numChildren: number): number {
  return computeSubtotal(breakdown, numAdults, numChildren) + computeGst(breakdown, numAdults, numChildren);
}
