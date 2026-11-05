'use client';
import { useEffect, useState } from 'react';
import { X, Tag, Copy, Check, Percent, IndianRupee } from 'lucide-react';
import { getWebsitePromos } from '@/lib/api';

interface WebPromo {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

export default function PromoPopup() {
  const [promos, setPromos] = useState<WebPromo[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const key = 'promo_popup_dismissed';
    if (sessionStorage.getItem(key)) return;

    getWebsitePromos()
      .then((r) => {
        const list: WebPromo[] = r.data.data || [];
        if (list.length === 0) return;
        setPromos(list);
        const timer = setTimeout(() => setVisible(true), 5000);
        return () => clearTimeout(timer);
      })
      .catch(() => {});
  }, []);

  if (!visible || promos.length === 0) return null;

  const promo = promos[idx];

  const handleCopy = () => {
    navigator.clipboard.writeText(promo.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('promo_popup_dismissed', '1');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-80 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-gold-600 to-brand-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Exclusive Offer</p>
              <p className="text-white/70 text-[10px]">Limited time promo</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Discount badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-xl font-bold px-3 py-1 rounded-xl ${promo.discountType === 'percentage' ? 'bg-gold-100 text-gold-700' : 'bg-brand-100 text-brand-700'}`}>
              {promo.discountType === 'percentage' ? <Percent className="w-4 h-4" /> : <IndianRupee className="w-4 h-4" />}
              {promo.discountValue}
              <span className="text-sm font-semibold ml-0.5">{promo.discountType === 'percentage' ? '% OFF' : ' OFF'}</span>
            </span>
          </div>

          {promo.description && (
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">{promo.description}</p>
          )}

          {/* Code + copy */}
          <div className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5">
            <span className="font-mono font-bold text-slate-900 text-sm tracking-widest flex-1">{promo.code}</span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2">Apply at checkout · Terms apply</p>
        </div>

        {/* Navigation when multiple promos */}
        {promos.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {promos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-gold-600 w-3' : 'bg-slate-300'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
