'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, Upload, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, Fingerprint, CreditCard, RefreshCw, Lock,
} from 'lucide-react';
import { uploadVaultDocument } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

interface KYCStatus { aadharFront: boolean; aadharBack: boolean; pan: boolean; }
interface Props { initialStatus: KYCStatus; onComplete: () => void; }

// Mirrors the server's upload filter, so an unsupported photo is caught before upload.
const ACCEPT = 'image/jpeg,image/png';
const MAX_BYTES = 10 * 1024 * 1024;

const PRIMARY_BTN =
  'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ' +
  'bg-gradient-to-br from-brand-800 to-brand-600 text-white shadow-[0_4px_15px_rgba(15,65,87,0.35)] ' +
  'hover:from-brand-900 hover:to-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ' +
  'disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed';

/* One document slot: pick, preview, replace. A real button, so it works from the keyboard. */
function DocSlot({
  title,
  hint,
  image,
  done,
  onPick,
  icon: Icon,
  tall,
}: {
  title: string;
  hint: string;
  image: string | null;
  done: boolean;
  onPick: () => void;
  icon: typeof Upload;
  tall?: boolean;
}) {
  const ready = done || !!image;
  return (
    <button
      type="button"
      onClick={done ? undefined : onPick}
      disabled={done}
      aria-label={done ? `${title}: already uploaded` : image ? `${title}: selected, choose a different file` : `Upload ${title}`}
      className={`group relative w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2
        ${tall ? 'min-h-[150px]' : 'min-h-[130px]'}
        ${ready ? 'border-green-300 bg-green-50/40' : 'border-dashed border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50'}
        ${done ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {image ? (
        <>
          <img src={image} alt="" className={`w-full ${tall ? 'h-28' : 'h-20'} rounded-lg object-cover border border-green-200`} />
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 group-hover:text-brand-600">
            <RefreshCw className="w-3 h-3" /> Change
          </span>
        </>
      ) : done ? (
        <>
          <span className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </span>
          <span className="text-xs font-semibold text-green-700">Already uploaded</span>
        </>
      ) : (
        <>
          <span className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-300 transition-colors">
            <Icon className="w-5 h-5 text-slate-400 group-hover:text-brand-500 transition-colors" />
          </span>
          <span>
            <span className="block text-xs font-semibold text-slate-700">{title}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>
          </span>
        </>
      )}
      {ready && (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          <CheckCircle2 className="w-2.5 h-2.5" /> Ready
        </span>
      )}
    </button>
  );
}

/* ── Main KYC Modal ── */
export default function KYCModal({ initialStatus, onComplete }: Props) {
  const [step, setStep] = useState<'aadhaar' | 'pan'>(
    (!initialStatus.aadharFront || !initialStatus.aadharBack) ? 'aadhaar' : 'pan'
  );
  const [uploading, setUploading] = useState(false);

  const [afFile, setAfFile] = useState<File | null>(null);
  const [afPreview, setAfPreview] = useState<string | null>(null);
  const [afDone, setAfDone] = useState(initialStatus.aadharFront);

  const [abFile, setAbFile] = useState<File | null>(null);
  const [abPreview, setAbPreview] = useState<string | null>(null);
  const [abDone, setAbDone] = useState(initialStatus.aadharBack);

  const [panFile, setPanFile] = useState<File | null>(null);
  const [panPreview, setPanPreview] = useState<string | null>(null);
  const [panDone, setPanDone] = useState(initialStatus.pan);

  const afRef  = useRef<HTMLInputElement>(null);
  const abRef  = useRef<HTMLInputElement>(null);
  const panRef = useRef<HTMLInputElement>(null);

  // Release preview blobs when they are replaced or the modal closes.
  useEffect(() => () => { if (afPreview) URL.revokeObjectURL(afPreview); }, [afPreview]);
  useEffect(() => () => { if (abPreview) URL.revokeObjectURL(abPreview); }, [abPreview]);
  useEffect(() => () => { if (panPreview) URL.revokeObjectURL(panPreview); }, [panPreview]);

  const handleFile = (side: 'front' | 'back' | 'pan', input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ''; // lets the same file be picked again after a rejection
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      toast({ title: 'Unsupported file', description: 'Please choose a JPG or PNG image.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Images must be under 10 MB.', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    if (side === 'front') { setAfFile(file); setAfPreview(url); }
    if (side === 'back')  { setAbFile(file); setAbPreview(url); }
    if (side === 'pan')   { setPanFile(file); setPanPreview(url); }
  };

  const uploadAadhaar = async () => {
    const tasks: { file: File; label: string }[] = [];
    if (!afDone && afFile) tasks.push({ file: afFile, label: 'Aadhaar Front' });
    if (!abDone && abFile) tasks.push({ file: abFile, label: 'Aadhaar Back' });
    if (!tasks.length) { setStep('pan'); return; }

    setUploading(true);
    try {
      for (const t of tasks) {
        const fd = new FormData();
        fd.append('file', t.file);
        fd.append('type', 'aadhar');
        fd.append('label', t.label);
        await uploadVaultDocument(fd);
      }
      if (!afDone && afFile) setAfDone(true);
      if (!abDone && abFile) setAbDone(true);
      toast({ title: 'Aadhaar saved', variant: 'success' });
      setStep('pan');
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const uploadPan = async () => {
    if (panDone) { onComplete(); return; }
    if (!panFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', panFile);
      fd.append('type', 'pan');
      fd.append('label', 'PAN Card');
      await uploadVaultDocument(fd);
      setPanDone(true);
      toast({ title: 'KYC documents saved', description: 'They are in your document vault.', variant: 'success' });
      onComplete();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.response?.data?.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const aadhaarDone = afDone && abDone;
  const canAadhaar  = (afDone || !!afFile) && (abDone || !!abFile);
  const canPan      = panDone || !!panFile;
  const totalDone   = [afDone || !!afFile, abDone || !!abFile, panDone || !!panFile].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">

      <input ref={afRef}  type="file" className="hidden" accept={ACCEPT} onChange={e => handleFile('front', e.target)} />
      <input ref={abRef}  type="file" className="hidden" accept={ACCEPT} onChange={e => handleFile('back',  e.target)} />
      <input ref={panRef} type="file" className="hidden" accept={ACCEPT} onChange={e => handleFile('pan',   e.target)} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-title"
        aria-describedby="kyc-desc"
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-3xl shadow-2xl"
      >

        {/* Header */}
        <div className="relative overflow-hidden px-6 pt-7 pb-6 bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700">
          <div aria-hidden className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20 motion-safe:animate-pulse bg-[radial-gradient(circle,theme(colors.gold.300),transparent)]" />

          <div className="relative z-10 flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/15 border border-white/25">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="kyc-title" className="text-white font-bold text-lg leading-tight">Verify Your Identity</h2>
              <p id="kyc-desc" className="text-brand-200 text-xs mt-0.5">Required to start any visa application</p>
            </div>
          </div>

          {/* Steps */}
          <ol className="relative z-10 flex items-center gap-2" aria-label="KYC steps">
            {[
              { id: 'aadhaar', label: 'Aadhaar Card', icon: Fingerprint, done: aadhaarDone },
              { id: 'pan',     label: 'PAN Card',     icon: CreditCard,  done: panDone },
            ].map((s) => (
              <li key={s.id}
                aria-current={step === s.id ? 'step' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  step === s.id
                    ? 'bg-white text-brand-800 shadow-lg'
                    : s.done
                    ? 'text-white/80 border border-white/20'
                    : 'text-white/50 border border-white/10'
                }`}>
                {s.done
                  ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                  : <s.icon className="w-3 h-3" />}
                {s.label}
              </li>
            ))}
            <li className="ml-auto text-white/60 text-xs font-mono" aria-label={`${totalDone} of 3 documents ready`}>{totalDone}/3</li>
          </ol>

          <div className="relative z-10 mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-gold-400 rounded-full transition-all duration-700"
              style={{ width: `${(totalDone / 3) * 100}%` }} />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {step === 'aadhaar' && (
            <div>
              <p className="text-center text-sm text-slate-500 mb-5">
                Upload <span className="font-semibold text-slate-700">both sides</span> of your Aadhaar card
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <DocSlot title="Front side" hint="JPG or PNG" icon={Upload}
                  image={afPreview} done={afDone} onPick={() => afRef.current?.click()} />
                <DocSlot title="Back side" hint="JPG or PNG" icon={Upload}
                  image={abPreview} done={abDone} onPick={() => abRef.current?.click()} />
              </div>

              <button type="button" onClick={uploadAadhaar} disabled={!canAadhaar || uploading} className={PRIMARY_BTN}>
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
                  : <>{aadhaarDone ? 'Continue' : 'Save & Continue'} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {step === 'pan' && (
            <div>
              <p className="text-center text-sm text-slate-500 mb-5">
                Upload the <span className="font-semibold text-slate-700">front side</span> of your PAN card
              </p>

              <div className="mb-5">
                <DocSlot title="PAN card front" hint="JPG or PNG, up to 10 MB" icon={CreditCard} tall
                  image={panPreview} done={panDone} onPick={() => panRef.current?.click()} />
              </div>

              <button type="button" onClick={uploadPan} disabled={!canPan || uploading} className={PRIMARY_BTN}>
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
                  : <><ShieldCheck className="w-4 h-4" />{panDone ? 'Continue to Dashboard' : 'Complete KYC'}</>}
              </button>

              <button
                type="button"
                onClick={() => setStep('aadhaar')}
                className="w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Aadhaar
              </button>
            </div>
          )}

        </div>

        <div className="px-6 pb-5">
          <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-slate-400 leading-relaxed">
            <Lock className="w-3 h-3 mt-0.5 shrink-0" />
            Stored privately in your document vault and only used to pre-fill your visa applications.
          </p>
        </div>
      </div>
    </div>
  );
}
