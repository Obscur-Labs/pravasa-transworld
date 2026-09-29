'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Upload, Trash2, Loader2, Scan, CheckCircle2,
  RotateCcw, ExternalLink, X, Fingerprint,
  CreditCard, BookOpen, GraduationCap, FileText, Image, File, RefreshCw,
} from 'lucide-react';
import { getVaultDocuments, getVaultDocumentUrl, uploadVaultDocument, deleteVaultDocument } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { Skeleton, CardGridSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

/* ─────────────────────────── types ─────────────────────────────────────── */
type DocType = 'aadhar' | 'pan' | 'passport' | 'photograph' | 'bank_statement' | 'degree' | 'other';
interface VaultDoc { _id: string; type: DocType; label: string; url: string; extractedData: Record<string, string>; createdAt: string; }

/* ─────────────────────────── config ─────────────────────────────────────── */
const CFG: Record<DocType, { label: string; sublabel: string; icon: React.ElementType; accept: string; twoSided?: true; ocr?: true }> = {
  aadhar:         { label: 'Aadhaar Card',      sublabel: 'Both sides required', icon: Fingerprint, accept: 'image/*',              twoSided: true, ocr: true  },
  pan:            { label: 'PAN Card',           sublabel: 'Front side only',     icon: CreditCard,  accept: 'image/*',              ocr: true                 },
  passport:       { label: 'Passport',           sublabel: 'Photo/data page',     icon: BookOpen,    accept: 'image/*,.pdf',          ocr: true                 },
  photograph:     { label: 'Photograph',         sublabel: 'Passport-size photo', icon: Image,       accept: 'image/*'                                          },
  bank_statement: { label: 'Bank Statement',     sublabel: 'Last 3–6 months',     icon: FileText,    accept: 'image/*,.pdf'                                     },
  degree:         { label: 'Degree Certificate', sublabel: 'Education document',  icon: GraduationCap, accept: 'image/*,.pdf'                                   },
  other:          { label: 'Other Document',     sublabel: 'Any supporting file', icon: File,        accept: 'image/*,.pdf,.doc,.docx'                          },
};
const ALL: DocType[] = ['aadhar', 'pan', 'passport', 'photograph', 'bank_statement', 'degree', 'other'];

/* PDF by extension, by the format param of a signed download link, or a Cloudinary raw resource */
const isPdf = (url: string) =>
  /\.pdf($|\?|#)/i.test(url) || /[?&]format=pdf(&|$)/i.test(url) || /\/raw\/(upload|download)/.test(url);

/* Open-doc button — fetches a backend-signed URL first so the browser
   never needs to send auth headers to Cloudinary directly.            */
function OpenDocBtn({ id, className }: { id: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const r = await getVaultDocumentUrl(id);
      window.open(r.data.data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: 'Could not open document', variant: 'destructive' });
    } finally { setLoading(false); }
  };
  return (
    <button onClick={open} disabled={loading} title="Open"
      className={`p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors ${className ?? ''}`}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ─────────────────────────── shared helpers ─────────────────────────────── */
const SaveBtn = ({ onClick, disabled, loading, label = 'Save to Vault' }: { onClick: () => void; disabled: boolean; loading: boolean; label?: string }) => (
  <button onClick={onClick} disabled={disabled || loading}
    className="w-full max-w-sm py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
    style={!disabled && !loading ? { background: 'linear-gradient(135deg,#0F4157,#207497)', color: '#fff', boxShadow: '0 4px 15px rgba(15,65,87,.35)' } : { background: '#f1f5f9', color: '#94a3b8' }}>
    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : label}
  </button>
);

/* ─────────────────────────── Aadhaar flip-card ──────────────────────────── */
function AadhaarUploader({ existingFront, existingBack, onDone }: { existingFront: VaultDoc | null; existingBack: VaultDoc | null; onDone: () => void; }) {
  const [flipped, setFlipped] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fFile, setFFile] = useState<File | null>(null);
  const [fPrev, setFPrev] = useState<string | null>(null);
  const [bFile, setBFile] = useState<File | null>(null);
  const [bPrev, setBPrev] = useState<string | null>(null);
  const fRef = useRef<HTMLInputElement>(null);
  const bRef = useRef<HTMLInputElement>(null);

  const pick = (side: 'f' | 'b', file: File) => {
    const url = URL.createObjectURL(file);
    if (side === 'f') { setFFile(file); setFPrev(url); }
    else { setBFile(file); setBPrev(url); setFlipped(true); }
  };

  const canSave = (existingFront || !!fFile) && (existingBack || !!bFile);

  const save = async () => {
    const tasks: { file: File; label: string }[] = [];
    if (!existingFront && fFile) tasks.push({ file: fFile, label: 'Aadhaar Front' });
    if (!existingBack && bFile)  tasks.push({ file: bFile, label: 'Aadhaar Back' });
    if (!tasks.length) { onDone(); return; }
    setUploading(true);
    try {
      for (const t of tasks) {
        const fd = new FormData();
        fd.append('file', t.file); fd.append('type', 'aadhar'); fd.append('label', t.label);
        await uploadVaultDocument(fd);
      }
      toast({ title: 'Aadhaar saved + OCR processed!', variant: 'success' });
      onDone();
    } catch (e: any) { toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  /* card face */
  const Face = ({ label, grad, prev, done, isBack = false, onPick }: {
    label: string; grad: string; prev: string | null; done: boolean; isBack?: boolean; onPick: () => void;
  }) => (
    <div className="absolute inset-0 rounded-2xl overflow-hidden"
      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', ...(isBack ? { transform: 'rotateY(180deg)' } : {}) }}>
      {prev ? (
        <div className="relative w-full h-full">
          <img src={prev} className="w-full h-full object-cover" alt={label} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <span className="text-white text-xs font-bold">{label}</span>
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>
          </div>
        </div>
      ) : done ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: grad }}>
          <CheckCircle2 className="w-10 h-10 text-white drop-shadow" />
          <p className="text-white text-xs font-semibold drop-shadow">{label} — already uploaded</p>
        </div>
      ) : (
        <div onClick={onPick} className="w-full h-full flex flex-col items-center justify-center cursor-pointer group relative" style={{ background: grad }}>
          {/* subtle grid texture */}
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 22px,rgba(255,255,255,.8) 22px,rgba(255,255,255,.8) 23px),repeating-linear-gradient(90deg,transparent,transparent 22px,rgba(255,255,255,.8) 22px,rgba(255,255,255,.8) 23px)' }} />
          <div className="absolute top-3 left-3 w-8 h-6 rounded bg-white/25 border border-white/35" />
          <div className="absolute top-3 right-3 text-white/40 text-[9px] font-mono tracking-[0.2em] uppercase">{label}</div>
          <div className="relative z-10 flex flex-col items-center gap-2.5">
            <div className="w-14 h-14 rounded-xl bg-white/20 border-2 border-dashed border-white/55 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <p className="text-white text-xs font-bold">Click to upload {label}</p>
            <p className="text-white/60 text-[10px]">JPG or PNG</p>
          </div>
          <div className="absolute bottom-3 left-3 right-3 h-px bg-white/20" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <input ref={fRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && pick('f', e.target.files[0])} />
      <input ref={bRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && pick('b', e.target.files[0])} />

      {/* 3-D flip card */}
      <div style={{ perspective: '1200px', width: '100%', maxWidth: 420 }}>
        <div style={{ width: '100%', height: 260, position: 'relative', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform .65s cubic-bezier(.4,.2,.2,1)' }}>
          <Face label="Front Side" grad="linear-gradient(135deg,#FF9933 0%,#FF9933 28%,#fff 44%,#fff 56%,#138808 72%,#138808 100%)" prev={fPrev} done={!!existingFront} onPick={() => fRef.current?.click()} />
          <Face label="Back Side" grad="linear-gradient(135deg,#1a237e 0%,#1565c0 50%,#0288d1 100%)" prev={bPrev} done={!!existingBack} isBack onPick={() => bRef.current?.click()} />
        </div>
      </div>

      {/* flip + chips row */}
      <button onClick={() => setFlipped(f => !f)}
        className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-full transition-all hover:scale-105 active:scale-95">
        <RotateCcw className="w-3.5 h-3.5" />{flipped ? 'See Front' : 'Turn Over'}
      </button>

      <div className="flex gap-2">
        {[{ label: 'Front', ok: !!(existingFront || fFile), fn: () => fRef.current?.click() },
          { label: 'Back',  ok: !!(existingBack  || bFile), fn: () => { setFlipped(true); setTimeout(() => bRef.current?.click(), 380); } }
        ].map(s => (
          <button key={s.label} onClick={s.fn}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium border transition-all ${s.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-brand-300 hover:text-brand-600'}`}>
            {s.ok ? <CheckCircle2 className="w-3 h-3" /> : <Upload className="w-3 h-3" />}{s.label}
          </button>
        ))}
      </div>

      <SaveBtn onClick={save} disabled={!canSave} loading={uploading} />
    </div>
  );
}

/* ─────────────────────────── PAN single card ────────────────────────────── */
function PanUploader({ existing, onDone }: { existing: VaultDoc | null; onDone: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!file) { if (existing) onDone(); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'pan'); fd.append('label', 'PAN Card');
      await uploadVaultDocument(fd);
      toast({ title: 'PAN Card saved + OCR!', variant: 'success' });
      onDone();
    } catch (e: any) { toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input ref={ref} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPrev(URL.createObjectURL(f)); } }} />

      {/* PAN card */}
      <div onClick={() => !existing && ref.current?.click()}
        className="relative overflow-hidden group"
        style={{ width: '100%', maxWidth: 420, height: 265, borderRadius: 16, cursor: existing ? 'default' : 'pointer', boxShadow: '0 20px 45px rgba(0,0,0,.22), 0 4px 12px rgba(0,0,0,.15)', background: 'linear-gradient(135deg,#061E27 0%,#0B2E3D 45%,#165874 100%)' }}>
        {/* diagonal shimmer */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
          style={{ background: 'linear-gradient(135deg,transparent 30%,rgba(255,255,255,.8) 50%,transparent 70%)', backgroundSize: '200% 200%', animation: 'shimmer 2s infinite' }} />
        {/* decorative pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '10px 10px' }} />
        <div className="absolute top-4 left-5 text-white/25 text-[9px] font-mono tracking-[0.25em]">INCOME TAX DEPT. INDIA</div>
        <div className="absolute top-4 right-5 w-10 h-7 rounded bg-yellow-400/25 border border-yellow-400/40" />
        <div className="absolute bottom-4 left-5 right-5 h-px bg-white/10" />

        {prev || existing ? (
          <>
            <img src={prev ?? existing?.url} className="w-full h-full object-cover" alt="PAN" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
              <span className="text-white text-xs font-bold">PAN Card</span>
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-dashed border-white/35 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
              <Upload className="w-7 h-7 text-white" />
            </div>
            <p className="text-white text-sm font-bold">PAN Card Front</p>
            <p className="text-brand-300 text-xs">Click to upload · JPG or PNG</p>
          </div>
        )}
      </div>

      <SaveBtn onClick={save} disabled={!file && !existing} loading={uploading} />
    </div>
  );
}

/* ─────────────────────────── Passport booklet ───────────────────────────── */
function PassportUploader({ existing, onDone }: { existing: VaultDoc | null; onDone: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!file) { if (existing) onDone(); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'passport'); fd.append('label', 'Passport Photo Page');
      await uploadVaultDocument(fd);
      toast({ title: 'Passport saved + OCR!', variant: 'success' });
      onDone();
    } catch (e: any) { toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <input ref={ref} type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (f.type.startsWith('image/')) setPrev(URL.createObjectURL(f)); } }} />

      {/* Booklet — portrait */}
      <div style={{ perspective: '900px' }}>
        <div onClick={() => !existing && ref.current?.click()}
          className="relative overflow-hidden cursor-pointer group transition-transform duration-300"
          style={{ width: 280, height: 390, borderRadius: 8, background: 'linear-gradient(165deg,#0d1b4b 0%,#1a237e 40%,#283593 100%)', boxShadow: '6px 10px 30px rgba(0,0,0,.45), inset -2px 0 8px rgba(0,0,0,.3)', transform: 'rotateY(-10deg) rotateX(3deg)' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'rotateY(-5deg) rotateX(1deg) scale(1.02)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'rotateY(-10deg) rotateX(3deg)')}>
          {/* spine */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-black/35" />
          {/* horizontal texture lines */}
          <div className="absolute inset-0 ml-4 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,white,white 1px,transparent 1px,transparent 6px)' }} />

          {prev || existing ? (
            <div className="absolute inset-0 ml-4 overflow-hidden">
              <img src={prev ?? existing?.url} className="w-full h-full object-cover" alt="Passport" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-4 left-3 text-white text-xs font-bold">Photo Page ✓</div>
            </div>
          ) : file && !file.type.startsWith('image/') ? (
            <div className="absolute inset-0 ml-4 flex flex-col items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-white/70" />
              <p className="text-white text-xs font-semibold">PDF selected</p>
              <p className="text-white/50 text-[10px] px-3 text-center truncate">{file.name}</p>
            </div>
          ) : (
            <div className="absolute inset-0 ml-4 flex flex-col items-center justify-center gap-4 px-4">
              {/* emblem */}
              <div className="w-20 h-20 rounded-full border-2 border-yellow-400/40 bg-yellow-400/10 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border border-yellow-300/30 bg-yellow-300/10 flex items-center justify-center">
                  <span className="text-yellow-300/50 text-2xl select-none">⊕</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-yellow-300/70 text-xs tracking-[0.3em] font-bold">INDIA</p>
                <p className="text-white/60 text-[10px] tracking-widest mt-0.5">PASSPORT</p>
              </div>
              <div className="w-full border-t border-white/10 pt-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-white/10 border-2 border-dashed border-white/30 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                  <Upload className="w-5 h-5 text-white/80" />
                </div>
                <p className="text-white/45 text-[10px]">Upload photo/data page</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveBtn onClick={save} disabled={!file && !existing} loading={uploading} />
    </div>
  );
}

/* ─────────────────────────── Polaroid (photograph) ─────────────────────── */
function PolaroidUploader({ existing, onDone }: { existing: VaultDoc | null; onDone: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!file) { if (existing) onDone(); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'photograph'); fd.append('label', 'Photograph');
      await uploadVaultDocument(fd);
      toast({ title: 'Photo saved!', variant: 'success' });
      onDone();
    } catch (e: any) { toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <input ref={ref} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPrev(URL.createObjectURL(f)); } }} />

      {/* Polaroid */}
      <div onClick={() => !existing && ref.current?.click()}
        className="cursor-pointer group"
        style={{ width: 250, background: '#fff', borderRadius: 4, padding: '12px 12px 44px', boxShadow: '0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1)', transform: 'rotate(-4deg)', transition: 'transform .3s, box-shadow .3s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(0deg) scale(1.04)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 22px 55px rgba(0,0,0,.22)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(-4deg)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,.18)'; }}>
        {/* photo area */}
        <div className="overflow-hidden rounded-sm" style={{ height: 215 }}>
          {prev || existing ? (
            <div className="relative w-full h-full">
              <img src={prev ?? existing?.url} className="w-full h-full object-cover" alt="Photograph" />
              {(prev || existing) && (
                <div className="absolute bottom-2 right-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 drop-shadow" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg,#fce7f3 0%,#fbcfe8 50%,#f9a8d4 100%)' }}>
              <div className="w-14 h-14 rounded-xl bg-white/50 border-2 border-dashed border-pink-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-6 h-6 text-pink-500" />
              </div>
              <p className="text-pink-600 text-xs font-semibold">Click to upload</p>
            </div>
          )}
        </div>
        {/* bottom label */}
        <div className="flex items-center justify-center mt-2" style={{ height: 32 }}>
          <p className="text-slate-400 text-xs text-center font-medium">
            {prev || existing ? '✓ Photograph ready' : 'Passport-size Photograph'}
          </p>
        </div>
      </div>

      <SaveBtn onClick={save} disabled={!file && !existing} loading={uploading} />
    </div>
  );
}

/* ─────────────────────────── A4 Sheet (statements, degree, other) ───────── */
const A4_THEME = {
  bank_statement: { grad: 'from-sky-600 to-brand-700',   emoji: '🏦', accent: '#3095C0', title: 'BANK STATEMENT' },
  degree:         { grad: 'from-amber-600 to-yellow-700', emoji: '🎓', accent: '#d97706', title: 'CERTIFICATE'    },
  other:          { grad: 'from-slate-500 to-slate-700', emoji: '📄', accent: '#64748b', title: 'DOCUMENT'        },
} as Record<string, { grad: string; emoji: string; accent: string; title: string }>;

function A4Uploader({ type, existing, onDone }: { type: DocType; existing: VaultDoc | null; onDone: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const theme = A4_THEME[type] ?? A4_THEME.other;
  const cfg   = CFG[type];

  const save = async () => {
    if (!file) { if (existing) onDone(); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('type', type); fd.append('label', cfg.label);
      await uploadVaultDocument(fd);
      toast({ title: `${cfg.label} saved!`, variant: 'success' });
      onDone();
    } catch (e: any) { toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  const isPDF = file?.type === 'application/pdf';

  return (
    <div className="flex flex-col items-center gap-5">
      <input ref={ref} type="file" className="hidden" accept={cfg.accept}
        onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (f.type.startsWith('image/')) setPrev(URL.createObjectURL(f)); else setPrev(null); } }} />

      {/* A4 paper with 3-D stacked shadow */}
      <div style={{ perspective: '1000px' }}>
        <div onClick={() => !existing && ref.current?.click()}
          className="relative overflow-hidden cursor-pointer group transition-transform duration-300"
          style={{ width: 270, height: 380, borderRadius: 4, background: type === 'degree' ? '#fffbf0' : '#fff', boxShadow: `4px 6px 0 #e2e8f0, 8px 10px 0 #cbd5e1, 0 20px 40px rgba(0,0,0,.12)`, transform: 'rotateX(5deg) rotateY(4deg)', ...(type === 'degree' ? { border: '1.5px solid #fcd34d' } : {}) }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'rotateX(2deg) rotateY(1deg) translateY(-10px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'rotateX(5deg) rotateY(4deg)')}>

          {/* header bar */}
          <div className={`bg-gradient-to-r ${theme.grad} px-4 py-3 flex items-center gap-2 flex-shrink-0`}>
            <span className="text-xl">{theme.emoji}</span>
            <span className="text-white text-[10px] font-bold tracking-widest">{theme.title}</span>
          </div>

          {/* body */}
          {prev ? (
            <img src={prev} className="w-full object-cover" style={{ height: 340 }} alt={cfg.label} />
          ) : existing ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 340 }}>
              <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: theme.accent }} />
              <p className="text-slate-600 text-sm font-semibold">{cfg.label}</p>
              <p className="text-slate-400 text-xs mt-1">Already uploaded</p>
            </div>
          ) : isPDF && file ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 340 }}>
              <FileText className="w-10 h-10" style={{ color: theme.accent }} />
              <p className="text-slate-700 text-sm font-semibold">PDF Selected</p>
              <p className="text-slate-400 text-[11px] px-4 text-center truncate max-w-full">{file.name}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 px-5" style={{ height: 340 }}>
              {/* ruled lines */}
              <div className="w-full space-y-2.5">
                {[...Array(5)].map((_, i) => <div key={i} className="h-px" style={{ background: theme.accent + '30', width: `${75 + (i % 3) * 8}%` }} />)}
              </div>
              {/* upload zone */}
              <div className="w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ borderColor: theme.accent + '60', background: theme.accent + '0d' }}>
                <Upload className="w-6 h-6" style={{ color: theme.accent }} />
              </div>
              <p className="text-slate-400 text-xs text-center">Click to upload PDF or image</p>
              <div className="w-full space-y-2.5">
                {[...Array(4)].map((_, i) => <div key={i} className="h-px" style={{ background: theme.accent + '20', width: `${60 + (i % 2) * 18}%` }} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveBtn onClick={save} disabled={!file && !existing} loading={uploading} />
    </div>
  );
}

/* ─────────────────────────── Other Doc Uploader (multi + custom label) ──── */
function OtherDocUploader({ onRefresh }: { onRefresh: () => void }) {
  const [label, setLabel]       = useState('');
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLabel(''); setFile(null); setPreview(null);
    if (ref.current) ref.current.value = '';
  };

  const save = async () => {
    if (!file || !label.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('type', 'other'); fd.append('label', label.trim());
      await uploadVaultDocument(fd);
      toast({ title: `"${label.trim()}" saved to vault!`, variant: 'success' });
      setSavedCount(c => c + 1);
      onRefresh();   // refresh gallery, keep panel open
      reset();       // clear for next upload
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const isPDF = file?.type === 'application/pdf';
  const isDoc = file && !file.type.startsWith('image/') && !isPDF;

  return (
    <div className="flex flex-col items-center gap-5">
      <input ref={ref} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
        onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null); } }} />

      {/* Label input */}
      <div className="w-full max-w-sm">
        <label className="text-xs font-bold text-slate-700 block mb-1.5">
          Document Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Offer Letter, NOC, Bank Statement Mar 2024…"
          className="w-full px-3.5 py-2.5 text-sm border-2 rounded-xl outline-none transition-all placeholder:text-slate-300"
          style={{ borderColor: label.trim() ? '#3095C0' : '#e2e8f0', boxShadow: label.trim() ? '0 0 0 3px rgba(48,149,192,.1)' : 'none' }}
        />
        {!label.trim() && file && (
          <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">⚠ Please enter a document name before saving.</p>
        )}
      </div>

      {/* A4 model — neutral grey */}
      <div style={{ perspective: '1200px' }}>
        <div onClick={() => ref.current?.click()}
          className="relative overflow-hidden cursor-pointer group transition-transform duration-300"
          style={{ width: 270, height: 380, borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: '4px 6px 0 #e2e8f0, 8px 10px 0 #cbd5e1, 0 20px 40px rgba(0,0,0,.1)', transform: 'rotateX(5deg) rotateY(4deg)' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'rotateX(2deg) rotateY(1deg) translateY(-10px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'rotateX(5deg) rotateY(4deg)')}>

          {/* header */}
          <div className="bg-gradient-to-r from-slate-500 to-slate-700 px-4 py-3 flex items-center gap-2">
            <span className="text-xl">📄</span>
            <span className="text-white text-[10px] font-bold tracking-widest truncate">{label.trim() || 'OTHER DOCUMENT'}</span>
          </div>

          {preview ? (
            <img src={preview} className="w-full object-cover" style={{ height: 340 }} alt="preview" />
          ) : isPDF ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 340 }}>
              <div className="w-14 h-16 bg-red-500 rounded-lg flex items-center justify-center shadow-md relative">
                <FileText className="w-7 h-7 text-white" />
                <div className="absolute -top-1 -right-1 bg-white border-2 border-red-400 text-red-500 text-[7px] font-bold px-1 rounded">PDF</div>
              </div>
              <p className="text-slate-700 text-sm font-semibold">PDF Ready</p>
              <p className="text-slate-400 text-[10px] px-4 text-center max-w-full truncate">{file!.name}</p>
            </div>
          ) : isDoc ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 340 }}>
              <File className="w-12 h-12 text-slate-400" />
              <p className="text-slate-700 text-sm font-semibold">Document Ready</p>
              <p className="text-slate-400 text-[10px] px-4 text-center max-w-full truncate">{file!.name}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 px-5" style={{ height: 340 }}>
              <div className="w-full space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-px bg-slate-200" style={{ width: `${75 + (i % 3) * 8}%` }} />)}</div>
              <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center group-hover:scale-110 group-hover:border-slate-400 transition-all duration-300">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 text-[11px] text-center leading-relaxed">Click to pick a file<br/><span className="text-slate-300">PDF · Image · Word (.doc/.docx)</span></p>
              <div className="w-full space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-px bg-slate-200" style={{ width: `${60 + (i % 2) * 18}%` }} />)}</div>
            </div>
          )}
        </div>
      </div>

      {/* session counter */}
      {savedCount > 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-4 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4" />
          {savedCount} document{savedCount > 1 ? 's' : ''} added this session
        </div>
      )}

      <SaveBtn onClick={save} disabled={!file || !label.trim()} loading={uploading} label="Save to Vault" />
    </div>
  );
}

/* ─────────────────────────── Mini tile preview ───────────────────────────── */
function MiniModel({ type, status }: { type: DocType; status: 'done' | 'partial' | 'empty' }) {
  const tick = status === 'done';

  const Done = () => tick ? <CheckCircle2 className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 text-green-400" /> : null;

  switch (type) {
    case 'aadhar':
      return (
        <div style={{ perspective: 500 }}>
          <div style={{ width: 88, height: 56, position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateY(-12deg) rotateX(6deg)', borderRadius: 10, overflow: 'hidden', boxShadow: '4px 6px 16px rgba(0,0,0,.22)', background: 'linear-gradient(135deg,#FF9933 0%,#FF9933 30%,#fff 44%,#fff 56%,#138808 70%,#138808 100%)' }}>
            <div className="absolute top-2 left-2 w-4 h-3 rounded-sm bg-white/30 border border-white/40" />
            <Done />
          </div>
          {/* back card depth */}
          <div style={{ position: 'absolute', width: 88, height: 56, borderRadius: 10, background: '#1565c0', transform: 'rotateY(-12deg) rotateX(6deg) translate(5px,5px)', zIndex: -1, opacity: .5, top: 0, left: 0 }} />
        </div>
      );
    case 'pan':
      return (
        <div style={{ width: 88, height: 56, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg,#061E27,#0B2E3D)', boxShadow: '4px 6px 16px rgba(0,0,0,.3)', transform: 'rotateY(-12deg) rotateX(6deg)', position: 'relative' }}>
          <div className="absolute top-1.5 left-2 text-yellow-400/40 text-[7px] font-mono">INCOME TAX</div>
          <div className="absolute top-1.5 right-2 w-5 h-3 rounded-sm bg-yellow-400/25 border border-yellow-400/35" />
          <Done />
        </div>
      );
    case 'passport':
      return (
        <div className="relative overflow-hidden" style={{ width: 52, height: 72, borderRadius: 5, background: 'linear-gradient(160deg,#0d1b4b,#1a237e)', boxShadow: '3px 6px 18px rgba(0,0,0,.4), inset -1px 0 4px rgba(0,0,0,.3)', transform: 'rotateY(-10deg) rotateX(5deg)' }}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/30" />
          <div className="absolute inset-0 ml-1.5 flex flex-col items-center justify-center gap-1">
            <div className="w-7 h-7 rounded-full border border-yellow-400/35 bg-yellow-400/10 flex items-center justify-center"><span className="text-yellow-300/50 text-xs">⊕</span></div>
            <p className="text-yellow-300/50 text-[6px] tracking-widest">PASSPORT</p>
          </div>
          {tick && <CheckCircle2 className="absolute bottom-1 right-1 w-3 h-3 text-green-400" />}
        </div>
      );
    case 'photograph':
      return (
        <div style={{ width: 52, height: 66, background: '#fff', padding: '5px 5px 16px', borderRadius: 3, boxShadow: '2px 5px 14px rgba(0,0,0,.2)', transform: 'rotate(-6deg)' }}>
          <div className="w-full overflow-hidden rounded-sm" style={{ height: 42, background: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' }}>
            {tick && <CheckCircle2 className="w-4 h-4 text-pink-500 mt-3 mx-auto" />}
          </div>
        </div>
      );
    case 'bank_statement':
      return (
        <div className="relative overflow-hidden" style={{ width: 66, height: 90, borderRadius: 3, background: '#fff', boxShadow: '2px 3px 0 #e2e8f0, 5px 6px 0 #cbd5e1, 0 10px 20px rgba(0,0,0,.1)', transform: 'rotateX(10deg) rotateY(5deg)' }}>
          <div className="h-5 bg-gradient-to-r from-sky-600 to-brand-700" style={{ borderRadius: '3px 3px 0 0' }} />
          <div className="p-1.5 space-y-1">{[...Array(7)].map((_, i) => <div key={i} className="h-px bg-slate-200" />)}</div>
          {tick && <CheckCircle2 className="absolute bottom-1.5 right-1.5 w-3 h-3 text-sky-500" />}
        </div>
      );
    case 'degree':
      return (
        <div className="relative overflow-hidden" style={{ width: 66, height: 90, borderRadius: 3, background: '#fffbf0', boxShadow: '2px 3px 0 #fef3c7, 5px 6px 0 #fde68a, 0 10px 20px rgba(0,0,0,.1)', border: '1.5px solid #fcd34d', transform: 'rotateX(10deg) rotateY(5deg)' }}>
          <div className="h-5 bg-gradient-to-r from-amber-600 to-yellow-600" style={{ borderRadius: '2px 2px 0 0' }} />
          <div className="p-1.5 space-y-1">{[...Array(7)].map((_, i) => <div key={i} className="h-px bg-amber-200/50" />)}</div>
          {tick && <CheckCircle2 className="absolute bottom-1.5 right-1.5 w-3 h-3 text-amber-500" />}
        </div>
      );
    default:
      return (
        <div className="relative overflow-hidden" style={{ width: 66, height: 90, borderRadius: 3, background: '#f8fafc', boxShadow: '2px 3px 0 #e2e8f0, 5px 6px 0 #cbd5e1, 0 10px 20px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', transform: 'rotateX(10deg) rotateY(5deg)' }}>
          <div className="h-5 bg-gradient-to-r from-slate-500 to-slate-600" style={{ borderRadius: '3px 3px 0 0' }} />
          <div className="p-1.5 space-y-1">{[...Array(7)].map((_, i) => <div key={i} className="h-px bg-slate-200" />)}</div>
          {tick && <CheckCircle2 className="absolute bottom-1.5 right-1.5 w-3 h-3 text-slate-500" />}
        </div>
      );
  }
}

/* ─────────────────────────── PDF Thumbnail ──────────────────────────────── */
function DocThumb({ url, label }: { url: string; label: string }) {
  if (isPdf(url)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="relative">
          <div className="w-12 h-14 bg-red-500 rounded-lg flex items-center justify-center shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 bg-white border-2 border-red-500 text-red-500 text-[8px] font-bold px-1 rounded">PDF</div>
        </div>
        <p className="text-[10px] text-slate-500 font-medium max-w-[110px] truncate text-center">{label}</p>
      </div>
    );
  }
  return (
    <>
      <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={label}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
    </>
  );
}

/* ─────────────────────────── Regular gallery card ───────────────────────── */
function GalleryCard({ doc, onReplace, onDelete, replacing, deleting }: {
  doc: VaultDoc; replacing: string | null; deleting: string | null;
  onReplace: (doc: VaultDoc, file: File) => void;
  onDelete:  (id: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
      <input ref={ref} type="file" className="hidden" accept={CFG[doc.type]?.accept ?? 'image/*'}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onReplace(doc, f); e.target.value = ''; } }} />

      <div className="h-36 bg-slate-100 relative overflow-hidden">
        <DocThumb url={doc.url} label={doc.label} />
        <span className="absolute top-2 left-2 bg-white/90 backdrop-blur text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          {CFG[doc.type]?.label ?? doc.type}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{doc.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(doc.createdAt)}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <OpenDocBtn id={doc._id} />
            <button onClick={() => ref.current?.click()} disabled={replacing === doc._id}
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Replace">
              {replacing === doc._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onDelete(doc._id)} disabled={deleting === doc._id}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              {deleting === doc._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {Object.keys(doc.extractedData ?? {}).length > 0 && (
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-[10px] font-bold text-brand-700 flex items-center gap-1 mb-1.5"><Scan className="w-3 h-3" />OCR Extracted</p>
            {Object.entries(doc.extractedData).slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-slate-400 capitalize">{k}</span>
                <span className="text-slate-700 font-medium truncate ml-2 max-w-[100px]">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Aadhaar single gallery card ────────────────── */
function AadhaarGalleryCard({ front, back, onReplace, onDelete, replacing, deleting }: {
  front: VaultDoc | null; back: VaultDoc | null;
  replacing: string | null; deleting: string | null;
  onReplace: (doc: VaultDoc, file: File) => void;
  onDelete:  (id: string) => void;
}) {
  const [showBack, setShowBack] = useState(false);
  const fRef = useRef<HTMLInputElement>(null);
  const bRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <input ref={fRef} type="file" className="hidden" accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f && front) { onReplace(front, f); e.target.value = ''; } }} />
      <input ref={bRef} type="file" className="hidden" accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f && back) { onReplace(back, f); e.target.value = ''; } }} />

      {/* flip-card thumbnail */}
      <div className="relative overflow-hidden" style={{ height: 160, perspective: '900px' }}>
        <div style={{
          transformStyle: 'preserve-3d',
          transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)',
          width: '100%', height: '100%', position: 'relative',
        }}>
          {/* front face */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            {front
              ? <img src={front.url} className="w-full h-full object-cover" alt="Aadhaar Front" />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FF9933 0%,#FF9933 30%,#fff 44%,#fff 56%,#138808 70%,#138808 100%)' }}>
                  <p className="text-xs font-semibold text-slate-700 bg-white/70 px-2 py-0.5 rounded">Front not uploaded</p>
                </div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          {/* back face */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            {back
              ? <img src={back.url} className="w-full h-full object-cover" alt="Aadhaar Back" />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a237e,#1565c0,#0288d1)' }}>
                  <p className="text-xs font-semibold text-white">Back not uploaded</p>
                </div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        </div>

        <span className="absolute top-2 left-2 bg-white/90 backdrop-blur text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          Aadhaar · {showBack ? 'Back' : 'Front'}
        </span>
        <button onClick={() => setShowBack(s => !s)}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-black/50 hover:bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur transition-colors">
          <RotateCcw className="w-3 h-3" />{showBack ? 'See Front' : 'Flip'}
        </button>
      </div>

      {/* side action rows */}
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-900 mb-3">Aadhaar Card</p>
        <div className="grid grid-cols-2 gap-2">
          {/* front */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-orange-700 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />Front
            </p>
            {front ? (
              <div className="flex gap-1">
                <button onClick={() => fRef.current?.click()} disabled={replacing === front._id}
                  className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                  {replacing === front._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Replace
                </button>
                <button onClick={() => onDelete(front._id)} disabled={deleting === front._id}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  {deleting === front._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ) : <p className="text-[10px] text-slate-400 italic">Not uploaded</p>}
          </div>

          {/* back */}
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-brand-700 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />Back
            </p>
            {back ? (
              <div className="flex gap-1">
                <button onClick={() => bRef.current?.click()} disabled={replacing === back._id}
                  className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold bg-white border border-brand-200 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                  {replacing === back._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Replace
                </button>
                <button onClick={() => onDelete(back._id)} disabled={deleting === back._id}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  {deleting === back._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ) : <p className="text-[10px] text-slate-400 italic">Not uploaded</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ───────────────────────────────────────── */
export default function DocumentVaultPage() {
  const [docs, setDocs]           = useState<VaultDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [active, setActive]       = useState<DocType | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);

  const fetch = async () => { try { const r = await getVaultDocuments(); setDocs(r.data.data); } finally { setLoading(false); } };
  useEffect(() => { fetch(); }, []);

  const byType  = (t: DocType) => docs.filter(d => d.type === t);
  const aadharF = docs.find(d => d.type === 'aadhar' && d.label.toLowerCase().includes('front')) ?? null;
  const aadharB = docs.find(d => d.type === 'aadhar' && d.label.toLowerCase().includes('back'))  ?? null;

  const status = (t: DocType): 'done' | 'partial' | 'empty' => {
    if (t === 'aadhar') return (aadharF && aadharB) ? 'done' : (aadharF || aadharB) ? 'partial' : 'empty';
    return byType(t).length > 0 ? 'done' : 'empty';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this document from your vault?')) return;
    setDeleting(id);
    try { await deleteVaultDocument(id); setDocs(d => d.filter(x => x._id !== id)); toast({ title: 'Removed from vault' }); }
    catch { toast({ title: 'Failed to delete', variant: 'destructive' }); }
    finally { setDeleting(null); }
  };

  const handleReplace = async (doc: VaultDoc, file: File) => {
    setReplacing(doc._id);
    try {
      await deleteVaultDocument(doc._id);
      const fd = new FormData();
      fd.append('file', file); fd.append('type', doc.type); fd.append('label', doc.label);
      await uploadVaultDocument(fd);
      toast({ title: 'Document replaced!', variant: 'success' });
      fetch();
    } catch (e: any) {
      toast({ title: 'Replace failed', description: e.response?.data?.message, variant: 'destructive' });
    } finally { setReplacing(null); }
  };

  const renderUploader = (t: DocType) => {
    const first = byType(t)[0] ?? null;
    const done  = () => { fetch(); setActive(null); };
    switch (t) {
      case 'aadhar':         return <AadhaarUploader existingFront={aadharF} existingBack={aadharB} onDone={done} />;
      case 'pan':            return <PanUploader       existing={first} onDone={done} />;
      case 'passport':       return <PassportUploader  existing={first} onDone={done} />;
      case 'photograph':     return <PolaroidUploader  existing={first} onDone={done} />;
      case 'bank_statement': return <A4Uploader type={t} existing={first} onDone={done} />;
      case 'degree':         return <A4Uploader type={t} existing={first} onDone={done} />;
      // 'other' stays open so user can keep adding more docs
      default:               return <OtherDocUploader onRefresh={fetch} />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Document Vault</h1>
        <p className="text-slate-500 text-sm mt-1">Store your identity documents once — OCR auto-extracts fields for faster visa applications.</p>
      </div>

      {/* type selector */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {ALL.map(t => {
          const cfg = CFG[t]; const s = status(t); const isActive = active === t;
          return (
            <button key={t} onClick={() => setActive(isActive ? null : t)}
              className={`relative flex flex-col items-center gap-2.5 p-3 pt-4 rounded-2xl border-2 transition-all duration-200 text-center overflow-hidden ${
                isActive    ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-100 scale-[1.04]'
                : s==='done'    ? 'border-green-200 bg-green-50/60 hover:border-green-400 hover:shadow-md'
                : s==='partial' ? 'border-amber-200 bg-amber-50/60 hover:border-amber-400 hover:shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'}`}>
              {/* status badge */}
              {s === 'done' && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-2.5 h-2.5 text-white" /></span>}
              {s === 'partial' && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">½</span>}

              {/* mini 3-D model */}
              <div className="flex items-center justify-center" style={{ height: 78 }}>
                <MiniModel type={t} status={s} />
              </div>

              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{cfg.label}</p>
              <p className="text-[9px] text-slate-400 leading-tight">{cfg.sublabel}</p>

              {/* active pointer */}
              {isActive && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-brand-500" />}
            </button>
          );
        })}
      </div>

      {/* upload panel */}
      {active && (
        <div className="relative bg-gradient-to-b from-slate-50 to-white rounded-3xl border-2 border-brand-100 p-7 mb-8 shadow-xl shadow-brand-50 mt-2 transition-all">
          <button onClick={() => setActive(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-slate-900 text-base mb-0.5">{CFG[active].label}</h3>
          <p className="text-slate-400 text-xs mb-7 flex items-center flex-wrap gap-2">
            {active === 'other' ? 'Add as many documents as you need — each gets its own name.' : CFG[active].sublabel}
            {CFG[active].ocr && <span className="inline-flex items-center gap-1 bg-brand-50 text-brand-600 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"><Scan className="w-2.5 h-2.5" />OCR auto-extract</span>}
            {active === 'other' && <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">Unlimited uploads</span>}
          </p>
          {renderUploader(active)}
        </div>
      )}

      {/* vault gallery */}
      {loading ? (
        <div>
          <Skeleton className="h-5 w-48 mb-4" />
          <CardGridSkeleton count={6} className="md:grid-cols-3" cardClassName="h-48" />
        </div>
      ) : docs.length === 0 && !active ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="text-5xl mb-3">🔐</div>
          <h3 className="font-semibold text-slate-700 mb-1">Vault is empty</h3>
          <p className="text-slate-400 text-sm">Select a document type above to upload.</p>
        </div>
      ) : docs.length > 0 && (() => {
        /* separate aadhar docs from everything else */
        const nonAadhar = docs.filter(d => d.type !== 'aadhar');
        const hasAadhar = !!(aadharF || aadharB);
        const total = nonAadhar.length + (hasAadhar ? 1 : 0);
        return (
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Your Vault <span className="text-slate-400 font-normal text-sm">({total} {total === 1 ? 'document' : 'documents'})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* single Aadhaar card grouping both sides */}
              {hasAadhar && (
                <AadhaarGalleryCard
                  front={aadharF} back={aadharB}
                  replacing={replacing} deleting={deleting}
                  onReplace={handleReplace}
                  onDelete={handleDelete}
                />
              )}
              {/* all other types */}
              {nonAadhar.map(doc => (
                <GalleryCard
                  key={doc._id}
                  doc={doc}
                  replacing={replacing}
                  deleting={deleting}
                  onReplace={handleReplace}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
