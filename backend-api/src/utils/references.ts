import Application from '../models/Application';

const digits = (n: number) => String(Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)));

/** Order number in the client's format: PRS-UNI-24817. */
export async function newReferenceId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = `PRS-UNI-${digits(5)}`;
    if (!(await Application.exists({ referenceId: candidate }))) return candidate;
  }
  return `PRS-UNI-${digits(7)}`;
}

/** Family group shared by an order and any child-only orders linked to it: FAM-0193. */
export async function newFamilyId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = `FAM-${digits(4)}`;
    if (!(await Application.exists({ familyId: candidate }))) return candidate;
  }
  return `FAM-${digits(6)}`;
}

/** The parent order's family group, giving older orders one on first use. */
export async function familyIdOf(applicationId: unknown): Promise<string> {
  const parent = await Application.findById(applicationId).select('familyId');
  if (!parent) return newFamilyId();
  if (parent.familyId) return parent.familyId;
  const familyId = await newFamilyId();
  await Application.updateOne({ _id: parent._id }, { $set: { familyId } });
  return familyId;
}
