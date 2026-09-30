import { ImageIcon } from 'lucide-react';

/** Opens the customer's payment screenshot. The link is signed and expires after an hour. */
export function PaymentProofLink({ url, className = '' }: { url?: string; className?: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ${className}`}>
      <ImageIcon className="w-3.5 h-3.5" />Screenshot
    </a>
  );
}
