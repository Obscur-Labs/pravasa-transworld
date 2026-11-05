'use client';
import { MessageCircle } from 'lucide-react';
import { useBusinessInfo, whatsappHref } from '@/lib/business';

export default function NotFoundWhatsApp() {
  const [phone] = useBusinessInfo().phones;
  if (!phone) return null;
  return (
    <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center h-12 rounded-lg px-8 text-base font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">
      <MessageCircle className="w-4 h-4 mr-2" />WhatsApp us
    </a>
  );
}
