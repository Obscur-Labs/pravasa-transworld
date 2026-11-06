'use client';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { Check, Link2, Loader2, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getParentCandidates, lookupParentApplication, verifyParentApplication } from '@/lib/api';
import { STATUS_LABELS } from '@/types';
import type { ParentCandidate, ParentRelation } from '@/types';

export interface ParentLinkValue {
  applicationId: string;
  ref: string;
  own: boolean;
  adults: { key: string; label: string; name: string }[];
  parents: { key: string; relation: ParentRelation }[];
  dob: string;
  verified: boolean;
}

export const parentLinkValid = (v: ParentLinkValue | null) => !!v && v.parents.length > 0 && (v.own || v.verified);

const RELATIONS: { value: ParentRelation; label: string }[] = [
  { value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'guardian', label: 'Guardian' },
];
const fmt = (s: string) => (s ? formatDate(s) : '');
const errorOf = (err: unknown) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Please try again.';

/**
 * A child-only order travels on a parent's earlier application to the same country.
 * Lists the customer's own applications, or finds another account's by application ID
 * or passport number; those show masked names and need the parent's date of birth.
 */
export default function ParentApplicationPicker({ countryId, from, to, value, onChange, onParentApplyingNow, showErrors }: {
  countryId: string;
  from: string;
  to: string;
  value: ParentLinkValue | null;
  onChange: (v: ParentLinkValue | null) => void;
  onParentApplyingNow: () => void;
  showErrors: boolean;
}) {
  const [candidates, setCandidates] = useState<ParentCandidate[] | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<ParentCandidate | null>(null);
  const [searchError, setSearchError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    let live = true;
    getParentCandidates({ country: countryId, from, to })
      .then((r) => { if (live) setCandidates(r.data.data); })
      .catch(() => { if (live) setCandidates([]); });
    return () => { live = false; };
  }, [countryId, from, to]);

  const select = (c: ParentCandidate) => {
    if (!c.eligibility.ok) return;
    onChange({
      applicationId: c._id, ref: c.referenceId, own: c.own, dob: '', verified: c.own,
      adults: c.adults.map(({ key, label, name }) => ({ key, label, name })),
      // A single adult is preselected; with two the customer says who is who.
      parents: c.adults.length === 1 ? [{ key: c.adults[0].key, relation: 'father' }] : [],
    });
  };

  const search = async () => {
    setSearching(true);
    setSearchError('');
    setFound(null);
    try {
      const r = await lookupParentApplication({ query, country: countryId, from, to });
      setFound(r.data.data);
    } catch (err) {
      setSearchError(errorOf(err));
    } finally {
      setSearching(false);
    }
  };

  const verify = async () => {
    if (!value) return;
    setVerifying(true);
    setVerifyError('');
    try {
      await verifyParentApplication({ applicationId: value.applicationId, dob: value.dob });
      onChange({ ...value, verified: true });
    } catch (err) {
      setVerifyError(errorOf(err));
    } finally {
      setVerifying(false);
    }
  };

  const toggleAdult = (key: string) => {
    if (!value) return;
    const has = value.parents.some((p) => p.key === key);
    const parents = has
      ? value.parents.filter((p) => p.key !== key)
      : [...value.parents, { key, relation: (value.parents.some((p) => p.relation === 'father') ? 'mother' : 'father') as ParentRelation }].slice(-2);
    onChange({ ...value, parents });
  };

  const card = (c: ParentCandidate) => {
    const selected = value?.applicationId === c._id;
    return (
      <button key={c._id} type="button" onClick={() => select(c)} disabled={!c.eligibility.ok} aria-pressed={selected}
        className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${
          selected ? 'border-gold-500 bg-gold-50/50' : c.eligibility.ok ? 'border-slate-200 hover:border-slate-300 bg-white' : 'border-slate-100 bg-slate-50 opacity-70 cursor-not-allowed'
        }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-slate-900">{c.referenceId}</span>
          <span className="text-xs text-slate-500">{c.visaName}</span>
          {selected && <Check className="w-4 h-4 text-green-600 ml-auto" />}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {c.adults.map((a) => a.name || a.label).join(', ') || 'No adult traveller'}
          {c.from && <> · {fmt(c.from)} to {fmt(c.to)}</>} · {STATUS_LABELS[c.status]}
        </p>
        {!c.eligibility.ok && <p className="text-xs font-medium text-red-600 mt-1">{c.eligibility.reason}</p>}
      </button>
    );
  };

  const own = (candidates || []).filter((c) => c.own);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        A child travelling without an adult on this application must be linked to a parent&apos;s application to the same country.
        The child&apos;s dates must fall within the parent&apos;s trip.
      </p>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your applications</p>
        {candidates === null ? (
          <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading...</p>
        ) : own.length === 0 ? (
          <p className="text-sm text-slate-400">You have no applications to this country yet. Search below, or add the parent to this application.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{own.map(card)}</div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parent filed separately?</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
            <Input className="pl-9" placeholder="Application ID (PRS-...) or parent's passport number" value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && query.trim() && search()} aria-label="Find parent application" />
          </div>
          <button type="button" onClick={search} disabled={searching || !query.trim()}
            className="px-4 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-sm font-semibold disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
          </button>
        </div>
        {searchError && <p className="text-xs text-red-600 mt-1" role="alert">{searchError}</p>}
        {found && <div className="mt-2">{card(found)}</div>}
      </div>

      {value && (
        <div className="rounded-xl border border-gold-200 bg-gold-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-gold-600" />Linking to {value.ref}
          </p>
          {!value.own && !value.verified && (
            <div>
              <p className="text-xs text-slate-600 mb-1.5">This application belongs to another account. Confirm the parent&apos;s date of birth to link it.</p>
              <div className="flex gap-2 items-center">
                <Input type="date" className="w-48" value={value.dob} onChange={(e) => onChange({ ...value, dob: e.target.value })} aria-label="Parent's date of birth" />
                <button type="button" onClick={verify} disabled={verifying || !value.dob}
                  className="px-3 h-10 rounded-lg border-2 border-brand-900 text-brand-900 text-sm font-semibold disabled:opacity-50">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
              {verifyError && <p className="text-xs text-red-600 mt-1" role="alert">{verifyError}</p>}
            </div>
          )}
          {value.verified && !value.own && (
            <p className="text-xs text-green-700 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Parent verified</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {value.adults.map((a) => {
              const link = value.parents.find((p) => p.key === a.key);
              return (
                <div key={a.key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!link} onChange={() => toggleAdult(a.key)} className="w-4 h-4 rounded" />
                    <span className="text-sm font-semibold text-slate-900">{a.name || a.label}</span>
                  </label>
                  {link && (
                    <div className="flex gap-1.5 mt-2" role="radiogroup" aria-label={`Relation of ${a.label}`}>
                      {RELATIONS.map((r) => (
                        <button key={r.value} type="button" role="radio" aria-checked={link.relation === r.value}
                          onClick={() => onChange({ ...value, parents: value.parents.map((p) => (p.key === a.key ? { ...p, relation: r.value } : p)) })}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${link.relation === r.value ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-green-700 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />The parent&apos;s passport copy is taken from {value.ref}; the child&apos;s birth certificate is still needed.
          </p>
        </div>
      )}

      {showErrors && !parentLinkValid(value) && (
        <p className="text-xs text-red-600" role="alert">
          {!value ? 'Pick the parent or guardian application.' : !value.parents.length ? 'Tick which adult is the parent or guardian.' : "Verify the parent's date of birth."}
        </p>
      )}

      <button type="button" onClick={onParentApplyingNow}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 hover:underline">
        <UserPlus className="w-4 h-4" />Parent applying now? Add them to this application
      </button>
    </div>
  );
}
