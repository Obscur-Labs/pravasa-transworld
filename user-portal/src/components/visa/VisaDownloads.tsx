import { Download, FileText } from 'lucide-react';
import type { VisaDownload } from '@/types';

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const extOf = (fileName: string) => fileName.split('.').pop()?.toUpperCase() || '';

/** Files the admin attached to a visa type (forms, checklists), each opening in a new tab. */
export default function VisaDownloads({ downloads }: { downloads: VisaDownload[] }) {
  return (
    <div>
      <p className="text-sm font-bold text-slate-800 mb-1">Downloads</p>
      <p className="text-xs text-slate-500 mb-3">Forms and checklists for this visa. Fill in or keep them handy while you apply.</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {downloads.map((d) => (
          <li key={d._id || d.url}>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              download={d.fileName || undefined}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{d.name}</span>
                <span className="block text-[11px] text-slate-400">
                  {[extOf(d.fileName), d.size ? fileSize(d.size) : ''].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-600" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
