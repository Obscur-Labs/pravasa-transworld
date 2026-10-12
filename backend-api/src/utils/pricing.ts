import { IVisaType, IAgentServiceFee } from '../models/VisaType';

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
  | 'b2bAdultServiceFee' | 'b2bChildServiceFee'
> & { agentServiceFees?: IAgentServiceFee[] };

export type PricingTier = 'individual' | 'corporate' | 'b2b_agent';

export function pricingTierOf(user: { accountType?: string; corporateType?: string } | null | undefined): PricingTier {
  if (user?.accountType !== 'corporate') return 'individual';
  return user.corporateType === 'b2b_agent' ? 'b2b_agent' : 'corporate';
}

type Id = { toString(): string } | null | undefined;

// The agent's own service fees, only while their individual pricing is switched on.
function agentFees(visaType: PricingFields, agentId: Id): IAgentServiceFee | undefined {
  if (!agentId) return undefined;
  return (visaType.agentServiceFees || []).find((a) => a.enabled && String(a.agent) === String(agentId));
}

/**
 * The service fee a tier pays. Unset overrides fall through:
 * agent's own fee -> common B2B -> corporate -> standard. 0 is a real (waived) value.
 */
function serviceFeeFor(tier: PricingTier, std?: number, corp?: number, b2b?: number, agent?: number): number {
  if (tier === 'b2b_agent' && agent != null) return agent;
  if (tier === 'b2b_agent' && b2b != null) return b2b;
  if (tier !== 'individual' && corp != null) return corp;
  return std || 0;
}

// Per-traveler pricing = visa fee + VFS fee + service fee. Visa and VFS fees are the same
// for everyone; only the service fee depends on the account (and, for agents, on who).
export function computeVisaPricing(visaType: PricingFields, tier: PricingTier, userId?: Id): PriceBreakdown {
  const own = tier === 'b2b_agent' ? agentFees(visaType, userId) : undefined;
  return {
    adultBase: visaType.adultPrice || visaType.price || 0,
    adultVfs: visaType.adultVfsFee || 0,
    adultFee: serviceFeeFor(tier, visaType.adultServiceFee, visaType.corporateAdultServiceFee, visaType.b2bAdultServiceFee, own?.adultFee),
    childBase: visaType.childPrice || 0,
    childVfs: visaType.childVfsFee || 0,
    childFee: serviceFeeFor(tier, visaType.childServiceFee, visaType.corporateChildServiceFee, visaType.b2bChildServiceFee, own?.childFee),
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
