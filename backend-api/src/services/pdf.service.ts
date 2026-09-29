import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';
import { IPayment } from '../models/Payment';
import { amountInWordsINR } from '../utils/numberToWords';

export interface CompanyInfo {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  fax: string;
  email: string;
  gstin: string;
  pan: string;
  stateName: string;
  stateCode: string;
  sacCode: string;
  logoUrl: string;
}

export interface ReceiptData {
  payment: IPayment & { application: any; user: any; promoCode?: { code: string } | null };
  appRef: string;
  userName: string;
  visaType: string;
  visaCategory?: string;
  country: string;
  receiptNumber?: string;
  adults: number;
  children: number;
  adultBase: number;   // visa fee per adult
  adultVfs: number;    // VFS fee per adult
  adultFee: number;    // service fee per adult
  childBase: number;
  childVfs: number;
  childFee: number;
  gstAmount: number;   // 18% GST snapshot (0 = legacy application, GST not added on top)
  accountType: 'individual' | 'corporate';
  clientGstin?: string;
  passportNumber?: string;
  visaNumber?: string;
  company: CompanyInfo;
}

const GST_RATE = 0.18;
const MARGIN = 40;
const PAGE_RIGHT = 555; // A4 width (595.28) minus margin

const inr = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const chunks: Buffer[] = [];
    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// Table column layout, x-offsets from the page's left margin.
const COLS = {
  sr: { x: MARGIN, w: 25 },
  desc: { x: MARGIN + 25, w: 215 },
  visaFees: { x: MARGIN + 240, w: 70 },
  vfsFees: { x: MARGIN + 310, w: 70 },
  servCharges: { x: MARGIN + 380, w: 70 },
  amount: { x: MARGIN + 450, w: 65 },
};

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const isCorporate = data.accountType === 'corporate';
  const { company } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    void renderReceipt(doc, data, isCorporate, company).then(() => doc.end()).catch(reject);
  });
}

async function renderReceipt(doc: PDFKit.PDFDocument, data: ReceiptData, isCorporate: boolean, company: CompanyInfo) {
  const receiptNo = data.receiptNumber || `VF-RCP-${String(data.payment._id).slice(-8).toUpperCase()}`;
  const paidDate = data.payment.paidAt ? new Date(data.payment.paidAt) : new Date();

  // ── Header: logo + company block ──────────────────────────────────────────
  let logoDrawn = false;
  if (company.logoUrl) {
    try {
      const buf = await fetchImageBuffer(company.logoUrl);
      doc.image(buf, MARGIN, 40, { fit: [90, 90] });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc.roundedRect(MARGIN, 40, 60, 60, 8).fill('#0B2E3D');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24)
      .text((company.companyName || 'P').trim().charAt(0).toUpperCase(), MARGIN, 62, { width: 60, align: 'center' });
  }

  doc.fillColor('#0B2E3D').font('Helvetica-Bold').fontSize(14).text(company.companyName || 'Pravasa Transworld', MARGIN + 110, 42, { width: PAGE_RIGHT - MARGIN - 110, align: 'right' });
  doc.fillColor('#b91c1c').font('Helvetica').fontSize(8);
  const addrLines = [company.addressLine1, company.addressLine2].filter(Boolean);
  addrLines.forEach((line) => doc.text(line as string, MARGIN + 110, doc.y, { width: PAGE_RIGHT - MARGIN - 110, align: 'right' }));
  const contactBits = [company.phone && `Tel: ${company.phone}`, company.fax && `Fax: ${company.fax}`].filter(Boolean).join('   ');
  if (contactBits) doc.text(contactBits, MARGIN + 110, doc.y, { width: PAGE_RIGHT - MARGIN - 110, align: 'right' });
  if (company.email) doc.text(`Email: ${company.email}`, MARGIN + 110, doc.y, { width: PAGE_RIGHT - MARGIN - 110, align: 'right' });
  if (company.gstin) doc.fillColor('#165874').text(`GSTIN: ${company.gstin}${company.stateName ? ` (${company.stateName.toUpperCase()})` : ''}`, MARGIN + 110, doc.y, { width: PAGE_RIGHT - MARGIN - 110, align: 'right' });

  doc.y = Math.max(doc.y, 115);
  doc.moveDown(0.8);

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.fillColor('#061E27').font('Helvetica-Bold').fontSize(16)
    .text(isCorporate ? 'TAX INVOICE' : 'PAYMENT RECEIPT', MARGIN, doc.y, { width: PAGE_RIGHT - MARGIN, align: 'center' });
  if (isCorporate) {
    doc.fontSize(9).fillColor('#7c3aed').font('Helvetica-Oblique').text('Original For Recipient', MARGIN, doc.y - 2, { width: PAGE_RIGHT - MARGIN, align: 'right' });
  }
  doc.moveDown(0.8);

  // ── Meta block: To M/s (left) + Invoice details (right) ────────────────────
  const metaTop = doc.y;
  const leftW = 300;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#061E27');
  doc.text('To M/s :', MARGIN, metaTop, { continued: true, width: leftW });
  doc.font('Helvetica').text(` ${data.userName}`);
  if (isCorporate && data.clientGstin) {
    doc.font('Helvetica-Bold').text('GSTIN :', MARGIN, doc.y, { continued: true, width: leftW });
    doc.font('Helvetica').text(` ${data.clientGstin}`);
  }
  doc.font('Helvetica-Bold').text('Country :', MARGIN, doc.y, { continued: true, width: leftW });
  doc.font('Helvetica').text(` ${data.country}`);

  const rightX = MARGIN + leftW + 20;
  const rightW = PAGE_RIGHT - rightX;
  let ry = metaTop;
  const rightRow = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#061E27').text(label, rightX, ry, { continued: true, width: rightW });
    doc.font('Helvetica').text(` ${value}`, { width: rightW });
    ry = doc.y;
  };
  rightRow('Receipt No. :', receiptNo);
  rightRow('Date :', paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  rightRow('Reference :', data.appRef);
  if (isCorporate && company.stateName) rightRow('Place Of Supply :', `${company.stateName.toUpperCase()}${company.stateCode ? ` - (${company.stateCode})` : ''}`);

  doc.y = Math.max(doc.y, ry) + 10;

  // ── Line items table ─────────────────────────────────────────────────────
  const tableTop = doc.y;
  const headerH = 20;
  drawTableHeader(doc, tableTop, headerH);
  let y = tableTop + headerH;

  const items: { qty: number; label: string; base: number; vfs: number; fee: number }[] = [];
  if (data.adults > 0) items.push({ qty: data.adults, label: 'Adult', base: data.adultBase, vfs: data.adultVfs, fee: data.adultFee });
  if (data.children > 0) items.push({ qty: data.children, label: 'Child', base: data.childBase, vfs: data.childVfs, fee: data.childFee });

  let sr = 1;
  let visaFeesTotal = 0;
  let vfsFeesTotal = 0;
  let servChargesTotal = 0;

  for (const item of items) {
    const descLines = [
      `Guest : ${data.userName}${item.qty > 1 ? ` (x${item.qty} ${item.label}${item.qty > 1 ? 's' : ''})` : ` (${item.label})`}`,
      `File No. : ${data.appRef}`,
      data.passportNumber && `Passport # : ${data.passportNumber}`,
      `Country : ${data.country}`,
      `Visa Type : ${(data.visaCategory || data.visaType).toUpperCase()}`,
      data.visaNumber && `Visa No. : ${data.visaNumber}`,
      `SAC Code : ${company.sacCode || '998555'}`,
    ].filter(Boolean) as string[];

    const rowVisaFees = item.base * item.qty;
    const rowVfsFees = item.vfs * item.qty;
    const rowServCharges = item.fee * item.qty;
    const rowAmount = rowVisaFees + rowVfsFees + rowServCharges;
    visaFeesTotal += rowVisaFees;
    vfsFeesTotal += rowVfsFees;
    servChargesTotal += rowServCharges;

    doc.fontSize(8);
    const descHeight = descLines.reduce((h, line) => h + doc.heightOfString(line, { width: COLS.desc.w - 10 }) + 2, 0) + 8;
    const rowHeight = Math.max(descHeight, 18);

    if (y + rowHeight > 780) { doc.addPage(); y = MARGIN; drawTableHeader(doc, y, headerH); y += headerH; }

    doc.font('Helvetica').fontSize(8).fillColor('#061E27');
    doc.text(String(sr), COLS.sr.x, y + 4, { width: COLS.sr.w, align: 'center' });

    let dy = y + 4;
    descLines.forEach((line, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(line, COLS.desc.x + 4, dy, { width: COLS.desc.w - 10 });
      dy = doc.y + 1;
    });

    doc.font('Helvetica').fontSize(8).text(inr(rowVisaFees), COLS.visaFees.x, y + 4, { width: COLS.visaFees.w - 6, align: 'right' });
    doc.text(inr(rowVfsFees), COLS.vfsFees.x, y + 4, { width: COLS.vfsFees.w - 6, align: 'right' });
    doc.text(inr(rowServCharges), COLS.servCharges.x, y + 4, { width: COLS.servCharges.w - 6, align: 'right' });
    doc.font('Helvetica-Bold').text(inr(rowAmount), COLS.amount.x, y + 4, { width: COLS.amount.w - 6, align: 'right' });

    drawColumnDividers(doc, y, rowHeight);
    y += rowHeight;
    doc.moveTo(COLS.sr.x, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
    sr += 1;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const discount = data.payment.discountApplied || 0;
  const netTotal = data.payment.amount;

  y += 6;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#061E27')
      .text(label, COLS.desc.x, y, { width: COLS.servCharges.x + COLS.servCharges.w - COLS.desc.x, align: 'right' });
    doc.text(value, COLS.amount.x, y, { width: COLS.amount.w - 6, align: 'right' });
    y += 16;
  };

  const grossSubtotal = visaFeesTotal + vfsFeesTotal + servChargesTotal;
  totalRow('Sub-Total', inr(grossSubtotal), true);

  if (data.gstAmount > 0) {
    // Current pricing: 18% GST is charged on the service fee only (visa + VFS are untaxed).
    totalRow(`GST @ ${(GST_RATE * 100).toFixed(2)}% (on service charges)`, `+${inr(data.gstAmount)}`);
  }

  if (discount > 0) {
    const code = data.payment.promoCode?.code;
    totalRow(`Discount${code ? ` (${code})` : ''}`, `-${inr(discount)}`);
  }

  if (data.gstAmount <= 0 && isCorporate) {
    // Legacy applications (created before GST-on-top): GST was treated as included in the total.
    const taxableValue = netTotal / (1 + GST_RATE);
    const gstAmount = netTotal - taxableValue;
    doc.moveTo(COLS.desc.x, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
    y += 6;
    totalRow('Taxable Value (Net Total ÷ 1.18)', inr(taxableValue));
    totalRow(`IGST @ ${(GST_RATE * 100).toFixed(2)}% (included)`, inr(gstAmount));
  }

  y += 4;
  doc.rect(MARGIN, y, PAGE_RIGHT - MARGIN, 22).fill('#e0f2fe');
  doc.fillColor('#061E27').font('Helvetica-Bold').fontSize(9)
    .text(amountInWordsINR(netTotal), MARGIN + 8, y + 6, { width: 320 });
  doc.fontSize(10).text('Net Total (INR)', COLS.desc.x, y + 6, { width: COLS.servCharges.x + COLS.servCharges.w - COLS.desc.x, align: 'right' });
  doc.text(inr(netTotal), COLS.amount.x, y + 6, { width: COLS.amount.w - 6, align: 'right' });
  y += 22;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.y = y + 30;
  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
    .text('This is a computer-generated document and does not require a physical signature.', MARGIN, doc.y, { width: PAGE_RIGHT - MARGIN, align: 'center' });
  if (company.email) doc.text(`For queries, contact ${company.email}`, MARGIN, doc.y, { width: PAGE_RIGHT - MARGIN, align: 'center' });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, height: number) {
  doc.rect(MARGIN, y, PAGE_RIGHT - MARGIN, height).fill('#e2e8f0');
  doc.fillColor('#061E27').font('Helvetica-Bold').fontSize(8);
  doc.text('Sr.', COLS.sr.x, y + 6, { width: COLS.sr.w, align: 'center' });
  doc.text('Narration / Description', COLS.desc.x + 4, y + 6, { width: COLS.desc.w - 6 });
  doc.text('Visa Fees', COLS.visaFees.x, y + 6, { width: COLS.visaFees.w - 6, align: 'right' });
  doc.text('VFS Fees', COLS.vfsFees.x, y + 6, { width: COLS.vfsFees.w - 6, align: 'right' });
  doc.text('Serv. Chrgs', COLS.servCharges.x, y + 6, { width: COLS.servCharges.w - 6, align: 'right' });
  doc.text('Amount (INR)', COLS.amount.x, y + 6, { width: COLS.amount.w - 6, align: 'right' });
  drawColumnDividers(doc, y, height);
  doc.moveTo(MARGIN, y).lineTo(PAGE_RIGHT, y).lineWidth(1).strokeColor('#061E27').stroke();
  doc.moveTo(MARGIN, y + height).lineTo(PAGE_RIGHT, y + height).lineWidth(1).strokeColor('#061E27').stroke();
}

function drawColumnDividers(doc: PDFKit.PDFDocument, y: number, height: number) {
  const xs = [COLS.sr.x, COLS.desc.x, COLS.visaFees.x, COLS.vfsFees.x, COLS.servCharges.x, COLS.amount.x, PAGE_RIGHT];
  doc.strokeColor('#cbd5e1').lineWidth(0.5);
  xs.forEach((x) => doc.moveTo(x, y).lineTo(x, y + height).stroke());
}

// ── Visa Details summary PDF (public "download PDF" button, apply flow) ──────

// One row of the "Information Required" table. Since fields and documents are a
// single ordered list, both kinds appear here, `kind` tells the applicant whether
// to answer it on the form or bring a file.
export interface VisaSummaryDocRow {
  kind: 'field' | 'document';
  name: string;
  description: string;
  required: boolean;
  applicantType: string;
}

export interface VisaSummaryData {
  visaName: string;
  countryName: string;
  description?: string;
  additionalNotes?: string;
  processingTime?: string;
  validity?: string;
  stayDuration?: string;
  visaSubTypeLabel?: string;
  visaCategoryLabel?: string;
  entryLabels?: string[];
  documents: VisaSummaryDocRow[];
}

const DOC_COLS = {
  name: { x: MARGIN, w: 150 },
  desc: { x: MARGIN + 150, w: 175 },
  provide: { x: MARGIN + 325, w: 65 },
  required: { x: MARGIN + 390, w: 70 },
  applies: { x: MARGIN + 460, w: 55 },
};

function drawDocTableHeader(doc: PDFKit.PDFDocument, y: number, height: number) {
  doc.rect(MARGIN, y, PAGE_RIGHT - MARGIN, height).fill('#e2e8f0');
  doc.fillColor('#061E27').font('Helvetica-Bold').fontSize(8);
  doc.text('Item', DOC_COLS.name.x + 4, y + 6, { width: DOC_COLS.name.w - 6 });
  doc.text('Description', DOC_COLS.desc.x + 4, y + 6, { width: DOC_COLS.desc.w - 6 });
  doc.text('Provide', DOC_COLS.provide.x, y + 6, { width: DOC_COLS.provide.w - 6, align: 'center' });
  doc.text('Requirement', DOC_COLS.required.x, y + 6, { width: DOC_COLS.required.w - 6, align: 'center' });
  doc.text('Applies To', DOC_COLS.applies.x, y + 6, { width: DOC_COLS.applies.w - 6, align: 'center' });
  const xs = [DOC_COLS.name.x, DOC_COLS.desc.x, DOC_COLS.provide.x, DOC_COLS.required.x, DOC_COLS.applies.x, PAGE_RIGHT];
  doc.strokeColor('#cbd5e1').lineWidth(0.5);
  xs.forEach((x) => doc.moveTo(x, y).lineTo(x, y + height).stroke());
  doc.moveTo(MARGIN, y).lineTo(PAGE_RIGHT, y).lineWidth(1).strokeColor('#061E27').stroke();
  doc.moveTo(MARGIN, y + height).lineTo(PAGE_RIGHT, y + height).lineWidth(1).strokeColor('#061E27').stroke();
}

export async function generateVisaSummaryPDF(data: VisaSummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderVisaSummary(doc, data);
    doc.end();
  });
}

function renderVisaSummary(doc: PDFKit.PDFDocument, data: VisaSummaryData) {
  // Header band
  doc.rect(0, 0, doc.page.width, 70).fill('#0B2E3D');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('Pravasa Transworld', MARGIN, 22);
  doc.fontSize(10).font('Helvetica').text('Visa Details', MARGIN, 46);

  doc.y = 95;
  doc.fillColor('#061E27').font('Helvetica-Bold').fontSize(16).text(`${data.countryName}: ${data.visaName}`, MARGIN, doc.y, { width: PAGE_RIGHT - MARGIN });
  doc.moveDown(0.8);

  // Key info grid
  const info: [string, string][] = [
    ...(data.processingTime ? [['Processing Time', data.processingTime] as [string, string]] : []),
    ...(data.validity ? [['Validity', data.validity] as [string, string]] : []),
    ...(data.stayDuration ? [['Stay Duration', data.stayDuration] as [string, string]] : []),
    ...(data.visaSubTypeLabel ? [['Visa Type', data.visaSubTypeLabel] as [string, string]] : []),
    ...(data.visaCategoryLabel ? [['Category', data.visaCategoryLabel] as [string, string]] : []),
    ...(data.entryLabels?.length ? [['Entry', data.entryLabels.join(' / ')] as [string, string]] : []),
  ];

  if (info.length > 0) {
    const colW = (PAGE_RIGHT - MARGIN) / 2;
    doc.rect(MARGIN, doc.y, PAGE_RIGHT - MARGIN, Math.ceil(info.length / 2) * 20 + 12).fill('#f1f5f9');
    const gy = doc.y + 8;
    info.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * colW + 10;
      const y = gy + row * 20;
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(label, x, y, { continued: true, width: colW - 20 });
      doc.font('Helvetica-Bold').fillColor('#061E27').text(`  ${value}`, { width: colW - 20 });
    });
    doc.y = gy + Math.ceil(info.length / 2) * 20 + 10;
    doc.moveDown(0.8);
  }

  // Description
  if (data.description?.trim()) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#061E27').text('About', MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(data.description.trim(), MARGIN, doc.y + 2, { width: PAGE_RIGHT - MARGIN });
    doc.moveDown(0.8);
  }

  // Documents table
  if (data.documents.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#061E27').text('Information Required', MARGIN, doc.y);
    doc.moveDown(0.4);

    const headerH = 20;
    let y = doc.y;
    drawDocTableHeader(doc, y, headerH);
    y += headerH;

    for (const row of data.documents) {
      doc.fontSize(8);
      const nameH = doc.heightOfString(row.name, { width: DOC_COLS.name.w - 8 });
      const descH = row.description ? doc.heightOfString(row.description, { width: DOC_COLS.desc.w - 8 }) : 0;
      const rowHeight = Math.max(nameH, descH, 14) + 12;

      if (y + rowHeight > 780) { doc.addPage(); y = MARGIN; drawDocTableHeader(doc, y, headerH); y += headerH; }

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#061E27').text(row.name, DOC_COLS.name.x + 4, y + 6, { width: DOC_COLS.name.w - 8 });
      doc.font('Helvetica').fillColor('#475569').text(row.description || '-', DOC_COLS.desc.x + 4, y + 6, { width: DOC_COLS.desc.w - 8 });
      doc.fillColor('#475569').font('Helvetica')
        .text(row.kind === 'document' ? 'Upload' : 'Answer', DOC_COLS.provide.x, y + 6, { width: DOC_COLS.provide.w - 6, align: 'center' });
      doc.fillColor(row.required ? '#b91c1c' : '#64748b').font('Helvetica-Bold')
        .text(row.required ? 'Required' : 'Optional', DOC_COLS.required.x, y + 6, { width: DOC_COLS.required.w - 6, align: 'center' });
      const appliesLabel = row.applicantType === 'child' ? 'Child' : row.applicantType === 'both' ? 'All' : 'Adult';
      doc.fillColor('#061E27').font('Helvetica').text(appliesLabel, DOC_COLS.applies.x, y + 6, { width: DOC_COLS.applies.w - 6, align: 'center' });

      const xs = [DOC_COLS.name.x, DOC_COLS.desc.x, DOC_COLS.provide.x, DOC_COLS.required.x, DOC_COLS.applies.x, PAGE_RIGHT];
      doc.strokeColor('#e2e8f0').lineWidth(0.5);
      xs.forEach((x) => doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke());

      y += rowHeight;
      doc.moveTo(MARGIN, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    }
    doc.y = y + 20;
  }

  // Additional Notes, kept at the very bottom, mirroring the visa overview modal.
  if (data.additionalNotes?.trim()) {
    doc.font('Helvetica-Bold').fontSize(8);
    const noteHeight = doc.heightOfString(data.additionalNotes.trim(), { width: PAGE_RIGHT - MARGIN - 20 }) + 30;
    if (doc.y + noteHeight > 780) { doc.addPage(); doc.y = MARGIN; }
    const notesY = doc.y;
    doc.rect(MARGIN, notesY, PAGE_RIGHT - MARGIN, noteHeight).fill('#fffbeb');
    doc.fillColor('#b45309').text('ADDITIONAL NOTES', MARGIN + 10, notesY + 8);
    doc.font('Helvetica').fontSize(9).fillColor('#78350f').text(data.additionalNotes.trim(), MARGIN + 10, notesY + 20, { width: PAGE_RIGHT - MARGIN - 20 });
    doc.y = notesY + noteHeight + 10;
  }

  doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
    .text('This document is for informational purposes only and does not constitute a visa guarantee.', MARGIN, doc.y, { width: PAGE_RIGHT - MARGIN, align: 'center' });
}
