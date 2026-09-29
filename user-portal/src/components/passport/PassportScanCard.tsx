'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Check, X, Upload, FileText, Loader2, ScanLine, Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { scanPassport } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

export const PASSPORT_FRONT_FIELDS = [
  'Passport No.', 'Surname', 'Given Name(s)', 'Nationality', 'Date of Birth',
  'Sex', 'Place of Birth', 'Place of Issue', 'Date of Issue', 'Date of Expiry',
];
export const PASSPORT_BACK_FIELDS = ['Father / Legal Guardian', 'Mother', 'Spouse', 'Address'];
export const PASSPORT_FIELDS = [...PASSPORT_FRONT_FIELDS, ...PASSPORT_BACK_FIELDS];

interface Props {
  requirementName: string;
  mode?: 'pair' | 'front' | 'back';
  frontFile: File | null;
  backFile: File | null;
  values: Record<string, string>;
  onFrontChange: (file: File | null) => void;
  onBackChange: (file: File | null) => void;
  onValuesChange: (values: Record<string, string>) => void;
}

interface SideProps {
  side: 'front' | 'back';
  file: File | null;
  preview: string | null;
  scanning: boolean;
  dragging: boolean;
  onPick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClear: () => void;
  onRescan: () => void;
}

// ── Draggable + resizable floating image viewer ───────────────────────────────
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function ImageViewerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 640, h: 480 });
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const dragging = useRef(false);
  const dragRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizing = useRef(false);
  const resizeRef = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const isFront = !title.includes('BACK');

  useEffect(() => {
    setPos({
      x: Math.max(20, window.innerWidth / 2 - 320),
      y: Math.max(20, window.innerHeight / 2 - 240),
    });
    setReady(true);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, dragRef.current.px + e.clientX - dragRef.current.mx),
          y: Math.max(0, dragRef.current.py + e.clientY - dragRef.current.my),
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(320, resizeRef.current.w + e.clientX - resizeRef.current.mx),
          h: Math.max(240, resizeRef.current.h + e.clientY - resizeRef.current.my),
        });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Scroll-wheel zoom on the image container
  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z - e.deltaY * 0.001).toFixed(3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ready]);

  const adjustZoom = (delta: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) / ZOOM_STEP) * ZOOM_STEP)));

  if (!ready) return null;

  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 9999 }}
      className="rounded-xl shadow-2xl border border-slate-300/80 bg-white flex flex-col overflow-hidden select-none"
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 cursor-move"
        style={{ background: isFront ? 'linear-gradient(135deg,#0f2d6b,#1a3a8f)' : 'linear-gradient(135deg,#111e42,#1a2a5c)' }}
        onMouseDown={(e) => {
          dragging.current = true;
          dragRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
          e.preventDefault();
        }}
      >
        <span style={{ color: 'rgba(212,175,55,0.9)', fontSize: 9, fontWeight: 700, letterSpacing: '0.28em' }}>
          {title}
        </span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
        >
          <X style={{ width: 10, height: 10, color: 'rgba(255,255,255,0.85)' }} />
        </button>
      </div>

      {/* Zoom toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 flex-shrink-0">
        <button
          onClick={() => adjustZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-colors"
        >
          <ZoomOut style={{ width: 13, height: 13 }} />
        </button>
        <span className="text-[11px] font-mono text-slate-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => adjustZoom(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-colors"
        >
          <ZoomIn style={{ width: 13, height: 13 }} />
        </button>
        <div className="w-px h-4 bg-slate-600 mx-0.5" />
        <button
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          title="Reset zoom"
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-colors"
        >
          <RotateCcw style={{ width: 11, height: 11 }} />
        </button>
        <span className="ml-auto text-[9px] text-slate-500">scroll to zoom</span>
      </div>

      {/* Image — scrollable when zoomed in */}
      <div
        ref={imgContainerRef}
        className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center"
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        <img
          src={src}
          alt={title}
          draggable={false}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease',
            maxWidth: zoom <= 1 ? '100%' : 'none',
            maxHeight: zoom <= 1 ? '100%' : 'none',
          }}
        />
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1"
        onMouseDown={(e) => {
          resizing.current = true;
          resizeRef.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="2" y1="10" x2="10" y2="2" stroke="rgba(100,116,139,0.45)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="6" y1="10" x2="10" y2="6" stroke="rgba(100,116,139,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function readPreview(file: File, set: (url: string | null) => void) {
  if (file.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = (e) => set(e.target?.result as string);
    r.readAsDataURL(file);
  } else set(null);
}

// ── Single-side card ──────────────────────────────────────────────────────────
function SideCard({ side, file, preview, scanning, dragging, onPick, onDrop, onDragOver, onDragLeave, onClear, onRescan }: SideProps) {
  const isFront = side === 'front';
  const hasFile = !!file;
  const [maximized, setMaximized] = useState(false);

  return (
    <>
      {maximized && preview && (
        <ImageViewerModal
          src={preview}
          title={isFront ? 'PASSPORT FRONT' : 'PASSPORT BACK'}
          onClose={() => setMaximized(false)}
        />
      )}

      <div
        className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
          hasFile ? 'border-green-300 bg-green-50' : dragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Header bar */}
        <div className="px-3 py-2 flex items-center justify-between" style={{ background: isFront ? 'linear-gradient(135deg,#0f2d6b,#1a3a8f)' : 'linear-gradient(135deg,#111e42,#1a2a5c)' }}>
          <span style={{ color: 'rgba(212,175,55,0.9)', fontSize: 9, fontWeight: 700, letterSpacing: '0.28em' }}>
            {isFront ? 'PASSPORT FRONT' : 'PASSPORT BACK'}
          </span>
          <div className="flex items-center gap-1.5">
            {preview && !scanning && (
              <button
                onClick={(e) => { e.stopPropagation(); setMaximized(true); }}
                title="Maximize"
                className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors"
              >
                <Maximize2 style={{ width: 9, height: 9, color: 'rgba(255,255,255,0.85)' }} />
              </button>
            )}
            {hasFile && !scanning && (
              <>
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <Check style={{ width: 9, height: 9, color: 'white' }} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onClear(); }}
                  className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <X style={{ width: 9, height: 9, color: 'rgba(255,255,255,0.8)' }} />
                </button>
              </>
            )}
            {scanning && <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-3 cursor-pointer" style={{ minHeight: 150 }} onClick={onPick}>
          {preview ? (
            <div className="relative w-full h-36 rounded-lg overflow-hidden border border-green-200">
              <img src={preview} alt={`Passport ${side}`} className="w-full h-full object-cover" />
              {scanning && (
                <div className="absolute inset-0 bg-brand-900/40 flex flex-col items-center justify-center gap-1 text-white">
                  <ScanLine className="w-5 h-5 animate-pulse" />
                  <span className="text-[10px] font-semibold">Reading…</span>
                </div>
              )}
            </div>
          ) : hasFile ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-[11px] font-semibold text-green-700 max-w-[140px] truncate">{file!.name}</p>
              <p className="text-[10px] text-green-500">PDF — fill the details manually</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className={`w-10 h-10 rounded-xl border-2 border-dashed flex items-center justify-center ${dragging ? 'border-brand-400 bg-brand-100' : 'border-slate-300 bg-white'}`}>
                <Camera className={`w-5 h-5 ${dragging ? 'text-brand-500' : 'text-slate-400'}`} />
              </div>
              <p className="text-[11px] font-semibold text-slate-600">{isFront ? 'Bio-data page' : 'Back / address page'}</p>
              <p className="text-[10px] text-slate-400">Click or drag & drop</p>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={onPick}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
            style={{ background: hasFile ? 'rgba(255,255,255,0.8)' : undefined, borderColor: hasFile ? '#86efac' : '#e2e8f0', color: hasFile ? '#15803d' : '#64748b' }}
          >
            <Upload className="w-3 h-3" />{hasFile ? 'Replace' : 'Upload'}
          </button>
          {/* Only photos can be read, so only they get a second look. */}
          {preview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRescan(); }}
              disabled={scanning}
              title="Read this photo again if some details came out wrong"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border border-brand-200 bg-white/80 text-brand-700 hover:bg-brand-50 transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              <RotateCcw className="w-3 h-3" />Scan again
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 flex items-center justify-center text-center min-h-[150px]">
      <p className="text-xs text-slate-400 max-w-[220px]">{text}</p>
    </div>
  );
}

export default function PassportScanCard({ requirementName, mode = 'pair', frontFile, backFile, values, onFrontChange, onBackChange, onValuesChange }: Props) {
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState<'front' | 'back' | null>(null);
  const [dragging, setDragging] = useState<'front' | 'back' | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  // Regenerate preview when a file is already present (e.g. after tab switch remounts this component)
  useEffect(() => {
    if (frontFile) readPreview(frontFile, setFrontPreview);
    else setFrontPreview(null);
  }, [frontFile]);

  useEffect(() => {
    if (backFile) readPreview(backFile, setBackPreview);
    else setBackPreview(null);
  }, [backFile]);

  /**
   * Reads one side and fills its fields on top of `base`. A re-scan asks the server for a
   * more careful second reading, and only replaces the fields it actually read, so a
   * failed re-scan never wipes what the applicant already has or typed.
   */
  const scanSide = useCallback(async (side: 'front' | 'back', file: File, base: Record<string, string>, rescan: boolean) => {
    // Auto-fill is best-effort; when it can't help, say so rather than leaving the fields
    // silently empty.
    const fillManually = (title: string) =>
      toast({ title, description: `Please type the ${side === 'front' ? 'front page' : 'back page'} details below.` });

    if (!file.type.startsWith('image/')) {
      fillManually('PDFs are not read automatically');
      return;
    }

    setScanning(side);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('side', side);
      if (rescan) fd.append('rescan', 'true');
      const r = await scanPassport(fd);
      const found = Object.entries((r.data?.data?.fields || {}) as Record<string, string>).filter(([, v]) => v);
      if (!found.length) {
        fillManually(rescan ? 'Still could not read this photo' : 'We could not read this photo');
        return;
      }
      onValuesChange({ ...base, ...Object.fromEntries(found) });
      if (rescan) toast({ title: 'Passport read again', description: 'Please check the details below before continuing.' });
    } catch {
      fillManually('Auto-fill is unavailable right now');
    } finally {
      setScanning(null);
    }
  }, [onValuesChange]);

  const handleFile = useCallback(async (side: 'front' | 'back', file: File) => {
    side === 'front' ? onFrontChange(file) : onBackChange(file);
    readPreview(file, side === 'front' ? setFrontPreview : setBackPreview);

    // Wipe fields for this side immediately so stale data from the old image disappears
    const sideFields = side === 'front' ? PASSPORT_FRONT_FIELDS : PASSPORT_BACK_FIELDS;
    const cleared = { ...values };
    sideFields.forEach((k) => { cleared[k] = ''; });
    onValuesChange(cleared);

    await scanSide(side, file, cleared, false);
  }, [values, onFrontChange, onBackChange, onValuesChange, scanSide]);

  const rescan = (side: 'front' | 'back') => {
    const file = side === 'front' ? frontFile : backFile;
    if (file && !scanning) scanSide(side, file, values, true);
  };

  const clear = (side: 'front' | 'back') => {
    side === 'front' ? (onFrontChange(null), setFrontPreview(null)) : (onBackChange(null), setBackPreview(null));
  };

  const setField = (key: string, val: string) => onValuesChange({ ...values, [key]: val });

  const isComplete = mode === 'pair' ? (!!frontFile && !!backFile) : mode === 'front' ? !!frontFile : !!backFile;
  const frontFilled = PASSPORT_FRONT_FIELDS.filter((k) => values[k]?.trim()).length;
  const backFilled = PASSPORT_BACK_FIELDS.filter((k) => values[k]?.trim()).length;

  const renderInput = (k: string) => (
    <div key={k}>
      <label className="text-[10px] font-medium text-slate-500">{k}</label>
      <input
        value={values[k] || ''}
        onChange={(e) => setField(k, e.target.value)}
        placeholder={scanning ? 'Reading…' : '—'}
        className="mt-0.5 w-full h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${isComplete ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isComplete ? 'bg-green-100' : 'bg-slate-100'}`}>
          {isComplete ? <Check className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{requirementName}<span className="text-red-500 ml-1">*</span></p>
          <p className="text-xs text-slate-400 mt-0.5">Upload each side — the details are read automatically and shown beside the image. Review and edit anything that looks off.</p>
        </div>
      </div>

      {mode !== 'back' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <SideCard
            side="front" file={frontFile} preview={frontPreview} scanning={scanning === 'front'} dragging={dragging === 'front'}
            onPick={() => frontRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragging(null); const f = e.dataTransfer.files[0]; if (f) handleFile('front', f); }}
            onDragOver={(e) => { e.preventDefault(); setDragging('front'); }}
            onDragLeave={() => setDragging(null)}
            onClear={() => clear('front')}
            onRescan={() => rescan('front')}
          />
          {frontFile ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">Passport Details — Front</p>
                <span className="text-[10px] text-slate-400">{frontFilled}/{PASSPORT_FRONT_FIELDS.length} filled</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                {PASSPORT_FRONT_FIELDS.map(renderInput)}
              </div>
            </div>
          ) : (
            <EmptyHint text="Upload the passport front (bio-data) page to auto-fill these details." />
          )}
        </div>
      )}

      {mode !== 'front' && (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start ${mode === 'pair' ? 'mt-4' : ''}`}>
          <SideCard
            side="back" file={backFile} preview={backPreview} scanning={scanning === 'back'} dragging={dragging === 'back'}
            onPick={() => backRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragging(null); const f = e.dataTransfer.files[0]; if (f) handleFile('back', f); }}
            onDragOver={(e) => { e.preventDefault(); setDragging('back'); }}
            onDragLeave={() => setDragging(null)}
            onClear={() => clear('back')}
            onRescan={() => rescan('back')}
          />
          {backFile ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">Passport Details — Back</p>
                <span className="text-[10px] text-slate-400">{backFilled}/{PASSPORT_BACK_FIELDS.length} filled</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                {['Father / Legal Guardian', 'Mother', 'Spouse'].map(renderInput)}
              </div>
              <div className="mt-2.5">
                <label className="text-[10px] font-medium text-slate-500">Address</label>
                <textarea
                  value={values['Address'] || ''}
                  onChange={(e) => setField('Address', e.target.value)}
                  rows={2}
                  placeholder={scanning ? 'Reading…' : '—'}
                  className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
          ) : (
            <EmptyHint text="Upload the passport back page to auto-fill family details and address." />
          )}
        </div>
      )}

      <input ref={frontRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile('front', f); e.target.value = ''; }} />
      <input ref={backRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile('back', f); e.target.value = ''; }} />
    </div>
  );
}
