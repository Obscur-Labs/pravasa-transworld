'use client';
import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/use-toast';
import { uploadBrandLogo } from '@/lib/api';

export interface BrandingValue { logoUrl: string; brandPrimary: string; brandAccent: string; brandFont: string; website: string }

export const BRAND_FONTS = ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
const HEX = /^#[0-9a-f]{6}$/i;

/** Logo, colours, font and website used on customer emails and receipts. Saved with the page. */
export function BrandingCard({ value, onChange }: { value: BrandingValue; onChange: (patch: Partial<BrandingValue>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await uploadBrandLogo(fd);
      onChange({ logoUrl: r.data.data.url });
    } catch (err: any) {
      toast({ title: 'Could not upload the logo', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const colour = (key: 'brandPrimary' | 'brandAccent', label: string) => (
    <div className="flex items-center gap-3">
      <input type="color" aria-label={`${label} colour`} value={HEX.test(value[key]) ? value[key] : '#000000'}
        onChange={(e) => onChange({ [key]: e.target.value.toUpperCase() })}
        className="h-9 w-9 rounded-md border border-border bg-transparent cursor-pointer p-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Input value={value[key]} maxLength={7} onChange={(e) => onChange({ [key]: e.target.value })}
          className={`mt-1 h-8 font-mono text-xs ${HEX.test(value[key]) ? '' : 'border-destructive'}`} />
      </div>
    </div>
  );

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="font-semibold text-foreground">Branding</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Used on customer emails and receipts. The website keeps its built-in navy and gold.</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-4 flex flex-col items-center justify-center text-center">
            {value.logoUrl
              ? <img src={value.logoUrl} alt="Current logo" className="max-h-16 max-w-[240px] object-contain" />
              : <ImageIcon className="w-10 h-10 text-muted-foreground" aria-hidden />}
            <p className="text-xs text-muted-foreground mt-2">{value.logoUrl ? 'Primary logo' : 'No logo yet; emails show the company name'}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                {value.logoUrl ? 'Replace' : 'Upload'}
              </Button>
              {value.logoUrl && <Button size="sm" variant="ghost" onClick={() => onChange({ logoUrl: '' })}>Remove</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
          <div className="rounded-lg border border-border p-4 space-y-3">
            {colour('brandPrimary', 'Navy (primary)')}
            {colour('brandAccent', 'Gold (accent)')}
          </div>
          <div>
            <Label htmlFor="brand-font">Font</Label>
            <NativeSelect id="brand-font" className="mt-1" value={value.brandFont} onChange={(e) => onChange({ brandFont: e.target.value })}>
              {BRAND_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="brand-website">Website URL</Label>
            <Input id="brand-website" className="mt-1" placeholder="www.pravasatransworld.com" value={value.website} onChange={(e) => onChange({ website: e.target.value })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
