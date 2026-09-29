/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-side normalisation for the merged application form (fields + documents in
 * one ordered list). The admin portal already does this before saving; doing it here
 * too means the API never depends on a particular client build being loaded, and a
 * half-filled row can't reach schema validation and 400 the whole save.
 */

/** "Phone Number" → "phoneNumber". Mirrors toFieldName() in the admin portal. */
export function toFieldName(label: string): string {
  const camel = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ''));
  if (!camel) return '';
  return /^\d/.test(camel) ? `field${camel[0].toUpperCase()}${camel.slice(1)}` : camel;
}

const str = (v: unknown) => String(v ?? '').trim();

/**
 * Drops rows the admin never filled in, fills any missing `fieldName` from the label
 * (keeping keys unique), and renumbers `order` across both arrays as one sequence.
 *
 * Only touches the arrays that are present, so it is safe on a partial update body.
 */
export function normalizeFormItems<T extends { formFields?: any[]; documentRequirements?: any[] }>(body: T): T {
  const hasFields = Array.isArray(body.formFields);
  const hasDocs = Array.isArray(body.documentRequirements);
  if (!hasFields && !hasDocs) return body;

  const fields = (hasFields ? body.formFields! : []).filter((f) => str(f?.label) || str(f?.fieldName));
  const docs = (hasDocs ? body.documentRequirements! : []).filter((d) => str(d?.name));

  // `order` spans both arrays. Coherent orders (all distinct) are authoritative.
  // Records written before documents had an `order` have every document at 0, that
  // duplication is the tell, and they fall back to "fields first, then documents" in
  // stored array order, exactly how they used to render. Mirrors mergeFormItems()
  // in both portals, so a plain open-and-save in the admin heals old data.
  const entries = [
    ...fields.map((field, i) => ({ kind: 'field' as const, order: Number(field?.order ?? 0), i, field })),
    ...docs.map((doc, i) => ({ kind: 'document' as const, order: Number(doc?.order ?? 0), i, doc })),
  ];
  const orders = entries.map((e) => e.order);
  const merged = new Set(orders).size === orders.length
    ? entries.sort((a, b) => a.order - b.order)
    : entries;

  const seen = new Set<string>();
  const uniqueName = (field: any): string => {
    const base = str(field?.fieldName) || toFieldName(field?.label) || 'field';
    let name = base;
    for (let n = 2; seen.has(name); n++) name = `${base}${n}`;
    seen.add(name);
    return name;
  };

  const hasOptions = (field: any) => field?.type === 'select' || field?.type === 'radio';

  // Triggers must be options the parent still offers; other parent types reveal on any answer.
  const normalizeSubFields = (parent: any) =>
    (Array.isArray(parent?.subFields) ? parent.subFields : [])
      .filter((sub: any) => str(sub?.label) || str(sub?.fieldName))
      .map((sub: any) => ({
        ...sub,
        label: str(sub?.label) || str(sub?.fieldName),
        fieldName: uniqueName(sub),
        showWhen: hasOptions(parent)
          ? (Array.isArray(sub?.showWhen) ? sub.showWhen : []).filter((v: string) => parent.options?.includes(v))
          : [],
      }));

  const nextFields: any[] = [];
  const nextDocs: any[] = [];
  merged.forEach((entry, order) => {
    if (entry.kind === 'field') {
      nextFields.push({
        ...entry.field,
        label: str(entry.field?.label) || str(entry.field?.fieldName),
        fieldName: uniqueName(entry.field),
        order,
        subFields: normalizeSubFields(entry.field),
      });
    } else {
      nextDocs.push({ ...entry.doc, name: str(entry.doc?.name), order });
    }
  });

  const out: T = { ...body };
  if (hasFields) out.formFields = nextFields;
  if (hasDocs) out.documentRequirements = nextDocs;
  return out;
}
