import { ITraveller, PARENT_RELATIONS, ParentRelation } from '../models/Application';

type ParentLinkInput = { key?: unknown; relation?: unknown };
type TravellerInput = { key?: unknown; parents?: ParentLinkInput[] };

// A child has at most two parent links (e.g. father and mother).
const MAX_PARENTS = 2;

/**
 * Every traveller on an order gets its own ID under the order's referenceId, which acts
 * as the family group: PRS-ARE-4821-A1, PRS-ARE-4821-C1. Keys match the apply form
 * (a0, a1, c0). Parent links from the client are kept only when they point at an adult
 * on the same order; anything else is dropped rather than failing the submission.
 */
export function buildTravellers(referenceId: string, adults: number, children: number, input: unknown): ITraveller[] {
  const adultKeys = Array.from({ length: adults }, (_, i) => `a${i}`);
  const sent = new Map<string, TravellerInput>(
    (Array.isArray(input) ? input : []).map((t: TravellerInput) => [String(t?.key ?? ''), t]),
  );

  const parentsOf = (key: string) => {
    const seen = new Set<string>();
    const links: { key: string; relation: ParentRelation }[] = [];
    for (const p of sent.get(key)?.parents || []) {
      const parentKey = String(p?.key ?? '');
      const relation = String(p?.relation ?? '') as ParentRelation;
      if (!adultKeys.includes(parentKey) || !PARENT_RELATIONS.includes(relation) || seen.has(parentKey)) continue;
      seen.add(parentKey);
      links.push({ key: parentKey, relation });
    }
    return links.slice(0, MAX_PARENTS);
  };

  return [
    ...adultKeys.map((key, i) => ({ ref: `${referenceId}-A${i + 1}`, key, kind: 'adult' as const, label: `Adult ${i + 1}`, parents: [] })),
    ...Array.from({ length: children }, (_, i) => {
      const key = `c${i}`;
      return { ref: `${referenceId}-C${i + 1}`, key, kind: 'child' as const, label: `Child ${i + 1}`, parents: parentsOf(key) };
    }),
  ];
}
