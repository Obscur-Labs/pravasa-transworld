import mongoose, { Document, Schema } from 'mongoose';

/** Singleton: team-wide security rules set by a super admin. */
export interface ITeamSettings extends Document {
  enforceTwoFactor: boolean;
}

const TeamSettingsSchema = new Schema<ITeamSettings>({ enforceTwoFactor: { type: Boolean, default: false } }, { timestamps: true });

const TeamSettings = mongoose.model<ITeamSettings>('TeamSettings', TeamSettingsSchema);

export const loadTeamSettings = () =>
  TeamSettings.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });

export const twoFactorEnforced = async () => !!(await TeamSettings.findOne().lean())?.enforceTwoFactor;

// Every admin request checks the rule, so it is cached briefly; saving the setting resets it.
let cached: { value: boolean; at: number } | null = null;
export async function twoFactorEnforcedCached(): Promise<boolean> {
  if (!cached || Date.now() - cached.at > 30_000) cached = { value: await twoFactorEnforced(), at: Date.now() };
  return cached.value;
}
export const resetTwoFactorCache = () => { cached = null; };

export default TeamSettings;
