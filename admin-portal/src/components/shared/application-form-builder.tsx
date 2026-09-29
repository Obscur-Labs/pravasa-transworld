'use client';
import { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown, TextCursorInput, Paperclip, GripVertical, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OptionListEditor } from './option-list-editor';
import { ApplicantTypeSelector } from './applicant-type-selector';
import { DOC_TYPE_OPTIONS, hasOptions, mergeFormItems, toFieldName } from '@/types';
import type { FormField, FormItem, DocumentRequirement, DocumentType, FieldType, SubField } from '@/types';
import { NativeSelect } from '@/components/ui/native-select';

const FIELD_TYPES: FieldType[] = ['text', 'number', 'email', 'date', 'select', 'radio', 'textarea'];
const isOcrDocType = (t: string) => t === 'passport_front' || t === 'passport_back';
const selectClass = 'mt-0.5 h-8 px-2 text-xs';

const emptyField = (): FormField => ({ label: '', fieldName: '', type: 'text', required: false, options: [], placeholder: '', order: 0, applicantType: 'adult', subFields: [] });
const emptySubField = (): SubField => ({ label: '', fieldName: '', type: 'text', required: false, options: [], placeholder: '', showWhen: [] });
const emptyDoc = (): DocumentRequirement => ({ name: '', description: '', required: true, applicantType: 'adult', docType: 'custom', ocrEnabled: false, order: 0 });

// Keeps fieldName in step with the label until the admin types their own.
const withLabel = <T extends { label: string; fieldName: string }>(q: T, label: string): T => {
  const autoNamed = !q.fieldName || q.fieldName === toFieldName(q.label);
  return { ...q, label, fieldName: autoNamed ? toFieldName(label) : q.fieldName };
};

interface ApplicationFormBuilderProps {
  fields: FormField[];
  docs: DocumentRequirement[];
  onChange: (next: { formFields: FormField[]; documentRequirements: DocumentRequirement[] }) => void;
}

function SubFieldEditor({ parent, sub, onChange, onRemove }: {
  parent: FormField;
  sub: SubField;
  onChange: (next: SubField) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<SubField>) => onChange({ ...sub, ...patch });
  const triggers = hasOptions(parent.type) ? parent.options : [];
  const toggleTrigger = (opt: string) =>
    set({ showWhen: sub.showWhen.includes(opt) ? sub.showWhen.filter((v) => v !== opt) : [...sub.showWhen, opt] });

  return (
    <div className="pl-3 border-l-2 border-primary/30 space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <CornerDownRight className="w-3.5 h-3.5 text-primary" />
        <span className="text-muted-foreground">Show when answer is</span>
        {triggers.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={sub.showWhen.includes(opt)}
            onClick={() => toggleTrigger(opt)}
            className={cn(
              'px-2 py-0.5 rounded-md border font-medium transition-colors',
              sub.showWhen.includes(opt)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
            )}
          >
            {opt}
          </button>
        ))}
        {!sub.showWhen.some((v) => triggers.includes(v)) && (
          <span className="font-medium text-foreground">anything</span>
        )}
        <button type="button" onClick={onRemove} aria-label="Remove follow-up"
          className="ml-auto p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Label</label>
          <Input className="mt-0.5 h-8 text-xs" placeholder="e.g. Describe the disability" value={sub.label} onChange={(e) => onChange(withLabel(sub, e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <NativeSelect value={sub.type} onChange={(e) => set({ type: e.target.value as FieldType })} className={selectClass}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Placeholder</label>
          <Input className="mt-0.5 h-8 text-xs" placeholder="Hint text" value={sub.placeholder} onChange={(e) => set({ placeholder: e.target.value })} />
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer w-fit">
        <input type="checkbox" checked={sub.required} onChange={(e) => set({ required: e.target.checked })} className="rounded" />
        Required when shown
      </label>
      {hasOptions(sub.type) && <OptionListEditor options={sub.options} onChange={(options) => set({ options })} />}
    </div>
  );
}

/** Questions and document uploads as one ordered list, shared by Visa Types and Form Presets. */
export function ApplicationFormBuilder({ fields, docs, onChange }: ApplicationFormBuilderProps) {
  const items = mergeFormItems(fields, docs);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Position in the merged list is the order, rewritten on every edit.
  const commit = (next: FormItem[]) =>
    onChange({
      formFields: next.flatMap((it, i) => (it.kind === 'field' ? [{ ...it.field, order: i }] : [])),
      documentRequirements: next.flatMap((it, i) => (it.kind === 'document' ? [{ ...it.doc, order: i }] : [])),
    });

  const addField = () => commit([...items, { kind: 'field', order: items.length, field: emptyField() }]);
  const addDoc = () => commit([...items, { kind: 'document', order: items.length, doc: emptyDoc() }]);
  const remove = (i: number) => commit(items.filter((_, idx) => idx !== i));

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  const handleDrop = (target: number) => {
    if (dragIndex !== null) reorder(dragIndex, target);
    setDragIndex(null);
    setDropIndex(null);
  };

  const setField = (i: number, fn: (f: FormField) => FormField) =>
    commit(items.map((it, idx) => (idx === i && it.kind === 'field' ? { ...it, field: fn(it.field) } : it)));

  const updateField = (i: number, key: keyof FormField, value: unknown) => setField(i, (f) => ({ ...f, [key]: value }));

  const setSubFields = (i: number, fn: (subs: SubField[]) => SubField[]) =>
    setField(i, (f) => ({ ...f, subFields: fn(f.subFields || []) }));

  const setDoc = (i: number, fn: (d: DocumentRequirement) => DocumentRequirement) =>
    commit(items.map((it, idx) => (idx === i && it.kind === 'document' ? { ...it, doc: fn(it.doc) } : it)));

  const updateDoc = (i: number, key: keyof DocumentRequirement, value: unknown) => setDoc(i, (d) => ({ ...d, [key]: value }));

  // Picking a type pre-fills the name unless the admin already typed a custom one.
  const updateDocType = (i: number, value: DocumentType) =>
    setDoc(i, (d) => {
      const opt = DOC_TYPE_OPTIONS.find((o) => o.value === value);
      const prevDefault = DOC_TYPE_OPTIONS.find((o) => o.value === (d.docType || 'custom'))?.defaultName;
      const name = !d.name.trim() || d.name === prevDefault ? opt?.defaultName ?? d.name : d.name;
      return { ...d, docType: value, name, ocrEnabled: isOcrDocType(value) };
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h4 className="font-semibold text-foreground text-sm">Application Form</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applicants see questions and uploads in this exact order. Drag a row by its handle, or use the arrows, to rearrange.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addField}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Field
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addDoc}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Document
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        {items.length === 0
          ? 'Nothing yet. Add the questions applicants answer and the documents they upload, in any order.'
          : <>Use <span className="font-medium">Applies to</span> to pick which travellers see each row, and <span className="font-medium">Follow-up</span> to ask more only for certain answers.</>}
      </p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); setDropIndex(i); } }}
            onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
            className={cn(
              'p-3 bg-muted/50 rounded-lg border transition-all',
              dragIndex === i ? 'border-primary opacity-40'
                : dropIndex === i && dragIndex !== null ? 'border-primary border-dashed bg-primary/5'
                : 'border-border',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {/* Only the handle drags, so text in the row stays selectable. */}
              <span
                draggable
                onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                title="Drag to reorder"
                className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground -ml-1 p-0.5 rounded"
              >
                <GripVertical className="w-4 h-4" />
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
                item.kind === 'field' ? 'text-primary bg-primary/10' : 'text-violet-600 bg-violet-500/10',
              )}>
                {item.kind === 'field' ? <TextCursorInput className="w-2.5 h-2.5" /> : <Paperclip className="w-2.5 h-2.5" />}
                {item.kind === 'field' ? 'Field' : 'Document'}
              </span>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">#{i + 1}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button type="button" onClick={() => reorder(i, i - 1)} disabled={i === 0} aria-label="Move up"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => reorder(i, i + 1)} disabled={i === items.length - 1} aria-label="Move down"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label="Remove"
                  className="p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {item.kind === 'field' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Label</label>
                    <Input className="mt-0.5 h-8 text-xs" placeholder="e.g. Phone Number" value={item.field.label} onChange={(e) => setField(i, (f) => withLabel(f, e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground" title="Auto-filled from the label. Only change it if you need a specific key.">Field Name</label>
                    <Input className="mt-0.5 h-8 text-xs" placeholder={toFieldName(item.field.label) || 'auto'} value={item.field.fieldName} onChange={(e) => updateField(i, 'fieldName', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <NativeSelect value={item.field.type} onChange={(e) => updateField(i, 'type', e.target.value)} className={selectClass}>
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </NativeSelect>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Placeholder</label>
                    <Input className="mt-0.5 h-8 text-xs" placeholder="Hint text" value={item.field.placeholder} onChange={(e) => updateField(i, 'placeholder', e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={item.field.required} onChange={(e) => updateField(i, 'required', e.target.checked)} className="rounded" />
                    Required
                  </label>
                  <ApplicantTypeSelector value={item.field.applicantType} onChange={(v) => updateField(i, 'applicantType', v)} />
                  <button type="button" onClick={() => setSubFields(i, (subs) => [...subs, emptySubField()])}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Plus className="w-3 h-3" />Follow-up
                  </button>
                </div>
                {hasOptions(item.field.type) && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Selection Options</p>
                    <OptionListEditor options={item.field.options} onChange={(opts) => updateField(i, 'options', opts)} />
                  </div>
                )}
                {item.field.subFields?.length ? (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    {item.field.subFields.map((sub, j) => (
                      <SubFieldEditor
                        key={j}
                        parent={item.field}
                        sub={sub}
                        onChange={(next) => setSubFields(i, (subs) => subs.map((s, k) => (k === j ? next : s)))}
                        onRemove={() => setSubFields(i, (subs) => subs.filter((_, k) => k !== j))}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <NativeSelect value={item.doc.docType || 'custom'} onChange={(e) => updateDocType(i, e.target.value as DocumentType)} className={selectClass}>
                      {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input className="mt-0.5 h-8 text-xs" placeholder="Document name" value={item.doc.name} onChange={(e) => updateDoc(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Input className="mt-0.5 h-8 text-xs" placeholder="Optional" value={item.doc.description} onChange={(e) => updateDoc(i, 'description', e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={item.doc.required} onChange={(e) => updateDoc(i, 'required', e.target.checked)} className="rounded" />
                    Required
                  </label>
                  <ApplicantTypeSelector value={item.doc.applicantType} onChange={(v) => updateDoc(i, 'applicantType', v)} />
                  {isOcrDocType(item.doc.docType || 'custom') && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Run OCR to auto-extract details when the applicant uploads this document">
                      <input type="checkbox" checked={item.doc.ocrEnabled !== false} onChange={(e) => updateDoc(i, 'ocrEnabled', e.target.checked)} className="rounded" />
                      OCR extraction
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
