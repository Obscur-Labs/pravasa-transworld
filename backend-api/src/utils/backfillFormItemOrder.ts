/**
 * One-time backfill for the merged application form.
 *
 * Form fields and document requirements used to live in two separately-rendered
 * blocks, so documents never needed an `order`, array position was enough. Now the
 * two share one interleaved sequence, which means every document needs an explicit
 * `order` that slots it against the fields.
 *
 * Existing visa types are given `fields first, then documents`, exactly how they
 * render today, so nothing moves until an admin deliberately reorders it.
 *
 * Safe to re-run: documents that already carry a non-zero order are left alone.
 *
 *   npx tsx src/utils/backfillFormItemOrder.ts          # apply
 *   npx tsx src/utils/backfillFormItemOrder.ts --dry    # preview only
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import VisaType from '../models/VisaType';
import FormPreset from '../models/FormPreset';

const DRY_RUN = process.argv.includes('--dry');

async function backfill(label: string, Model: mongoose.Model<any>) {
  const docs = await Model.find().select('name formFields documentRequirements');
  let changed = 0;

  for (const doc of docs) {
    const fields = doc.formFields || [];
    const reqs = doc.documentRequirements || [];
    if (reqs.length === 0) continue;

    // Already migrated, some document carries a real position.
    if (reqs.some((r: any) => typeof r.order === 'number' && r.order > 0)) continue;

    fields.forEach((f: any, i: number) => { f.order = i; });
    reqs.forEach((r: any, i: number) => { r.order = fields.length + i; });

    const span = (start: number, count: number) => (count === 0 ? 'none' : count === 1 ? `order ${start}` : `order ${start}..${start + count - 1}`);
    console.log(`  ${doc.name}: ${fields.length} field(s) ${span(0, fields.length)}, ${reqs.length} doc(s) ${span(fields.length, reqs.length)}`);
    if (!DRY_RUN) await doc.save();
    changed++;
  }

  console.log(`${label}: ${changed} of ${docs.length} updated${DRY_RUN ? ' (dry run, nothing written)' : ''}\n`);
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(DRY_RUN ? 'DRY RUN: no writes\n' : 'Applying backfill\n');

  await backfill('VisaType', VisaType as unknown as mongoose.Model<any>);
  await backfill('FormPreset', FormPreset as unknown as mongoose.Model<any>);

  await mongoose.disconnect();
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
