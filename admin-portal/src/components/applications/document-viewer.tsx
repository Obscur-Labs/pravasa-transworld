'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, RotateCw, X, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ViewerDoc { id: string; label: string; url: string; status: 'pending' | 'approved' | 'rejected' }

const MIN = 50;
const MAX = 300;
// Signed links carry the type either as the file extension or as format=pdf.
const isPdf = (url: string) => /\.pdf(\?|$)|[?&]format=pdf/i.test(url);

/**
 * Full-screen review of one traveller's uploads: zoom 50 to 300%, rotate, previous and
 * next, approve or reject. Keys: arrows to move, + and - to zoom, R to rotate, Esc to close.
 */
export function DocumentViewer({ docs, index, onIndex, onClose, onApprove, onReject }: {
  docs: ViewerDoc[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const doc = docs[index];

  useEffect(() => { setZoom(100); setRotation(0); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < docs.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX, z + 25));
      else if (e.key === '-') setZoom((z) => Math.max(MIN, z - 25));
      else if (e.key.toLowerCase() === 'r') setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, docs.length, onClose, onIndex]);

  if (!doc) return null;
  const pdf = isPdf(doc.url);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={`Viewing ${doc.label}`}>
      <div className="flex items-center gap-2 px-4 py-3 text-white">
        <p className="text-sm font-semibold truncate flex-1">{doc.label}</p>
        <span className="text-xs text-white/60 tabular-nums">{index + 1} / {docs.length}</span>
        {!pdf && (
          <>
            <button type="button" onClick={() => setZoom((z) => Math.max(MIN, z - 25))} className="p-2 rounded hover:bg-white/10" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs tabular-nums w-10 text-center">{zoom}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(MAX, z + 25))} className="p-2 rounded hover:bg-white/10" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="p-2 rounded hover:bg-white/10" aria-label="Rotate"><RotateCw className="w-4 h-4" /></button>
          </>
        )}
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-white/10" aria-label="Download"><Download className="w-4 h-4" /></a>
        <button type="button" onClick={onClose} className="p-2 rounded hover:bg-white/10" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>

      <div className="relative flex-1 overflow-auto flex items-center justify-center">
        {pdf ? (
          <iframe src={doc.url} title={doc.label} className="w-full h-full bg-white" />
        ) : (
          <img src={doc.url} alt={doc.label} draggable={false}
            style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})`, transition: 'transform 150ms' }}
            className="max-h-full max-w-full object-contain select-none" />
        )}
        {index > 0 && (
          <button type="button" onClick={() => onIndex(index - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous document">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {index < docs.length - 1 && (
          <button type="button" onClick={() => onIndex(index + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next document">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${doc.status === 'approved' ? 'bg-green-500/20 text-green-300' : doc.status === 'rejected' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70'}`}>
          {doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Pending review'}
        </span>
        {doc.status !== 'approved' && (
          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => onApprove(doc.id)}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />Approve
          </Button>
        )}
        {doc.status !== 'rejected' && (
          <Button size="sm" variant="destructive" onClick={() => onReject(doc.id)}>
            <XCircle className="w-4 h-4 mr-1.5" />Reject with reason
          </Button>
        )}
      </div>
    </div>
  );
}
