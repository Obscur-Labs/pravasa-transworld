import 'dotenv/config';
import { connectDB } from '../config/database';
import VisaConfigOption from '../models/VisaConfigOption';

// Idempotent backfill of the option lists that used to be hardcoded on the Visa Types
// page, safe to re-run; only inserts options that don't already exist.
const options = [
  { category: 'jurisdiction', value: 'pan-india', label: 'Pan India', order: 0 },
  { category: 'jurisdiction', value: 'mumbai', label: 'Mumbai', order: 1 },
  { category: 'jurisdiction', value: 'delhi', label: 'Delhi', order: 2 },

  { category: 'visaCategory', value: 'tourist', label: 'Tourist Visa', order: 0 },
  { category: 'visaCategory', value: 'business', label: 'Business Visa', order: 1 },
  { category: 'visaCategory', value: 'transit', label: 'Transit Visa', order: 2 },
  { category: 'visaCategory', value: 'student', label: 'Student Visa', order: 3 },

  { category: 'visaSubType', value: 'e-visa', label: 'E-Visa', order: 0 },
  { category: 'visaSubType', value: 'sticker', label: 'Sticker Visa', order: 1 },

  { category: 'entryType', value: 'single', label: 'Single', order: 0 },
  { category: 'entryType', value: 'multiple', label: 'Multiple', order: 1 },
  { category: 'entryType', value: 'double', label: 'Double', order: 2 },
];

async function seedVisaConfig() {
  await connectDB();
  console.log('Connected to MongoDB');

  let inserted = 0;
  let skipped = 0;

  for (const o of options) {
    const result = await VisaConfigOption.updateOne(
      { category: o.category, value: o.value },
      { $setOnInsert: { ...o, isActive: true } },
      { upsert: true }
    );
    if (result.upsertedCount) inserted++;
    else skipped++;
  }

  console.log(`Done: ${inserted} inserted, ${skipped} already existed`);
  process.exit(0);
}

seedVisaConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
