import ReceiptConfig, { IReceiptConfig } from '../models/ReceiptConfig';
import type { ReceiptData, CompanyInfo } from '../services/pdf.service';

const DEFAULT_COMPANY: CompanyInfo = {
  companyName: 'Pravasa Transworld',
  addressLine1: '',
  addressLine2: '',
  phone: '',
  fax: '',
  email: '',
  gstin: '',
  pan: '',
  stateName: '',
  stateCode: '',
  sacCode: '998555',
  logoUrl: '',
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const config = await ReceiptConfig.findOne().lean<IReceiptConfig>();
  if (!config) return DEFAULT_COMPANY;
  const { companyName, addressLine1, addressLine2, phone, fax, email, gstin, pan, stateName, stateCode, sacCode, logoUrl } = config;
  return { companyName, addressLine1, addressLine2, phone, fax, email, gstin, pan, stateName, stateCode, sacCode, logoUrl };
}

// Best-effort passport lookup, the field name is admin-configurable per visa type
// (FormField.fieldName), so there's no guaranteed single key across every visa type.
function findPassportNumber(formResponses: unknown): string {
  try {
    const map = formResponses as Map<string, string> | undefined;
    if (!map || typeof map.get !== 'function') return '';
    return map.get('passportNumber') || map.get('passport') || '';
  } catch {
    return '';
  }
}

export async function buildReceiptData(payment: any, receiptNumber: string): Promise<ReceiptData> {
  const app = payment.application;
  const user = payment.user;
  const company = await getCompanyInfo();
  const accountType: 'individual' | 'corporate' = user.accountType === 'corporate' ? 'corporate' : 'individual';

  return {
    payment,
    appRef: app.referenceId,
    userName: user.name,
    visaType: app.visaType?.name || 'N/A',
    visaCategory: app.visaType?.visaCategory || '',
    country: app.country?.name || 'N/A',
    receiptNumber,
    adults: app.adults || 1,
    children: app.children || 0,
    adultBase: app.adultBase || 0,
    adultVfs: app.adultVfs || 0,
    adultFee: app.adultFee || 0,
    childBase: app.childBase || 0,
    childVfs: app.childVfs || 0,
    childFee: app.childFee || 0,
    gstAmount: app.gstAmount || 0,
    accountType,
    clientGstin: accountType === 'corporate' ? (user.gstNumber || '') : '',
    passportNumber: findPassportNumber(app.formResponses),
    visaNumber: app.processingReferenceNumber || '',
    company,
  };
}
