import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { SERVICES } from '@/lib/services';

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-8">
          <div className="sm:col-span-3 md:col-span-2">
            <img
              src="/logo.png"
              alt="Pravasa Transworld"
              width={1841}
              height={516}
              className="h-11 w-auto mb-5"
            />
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mb-6 font-semibold">
              Professional visa assistance that simplifies your journey from application to approval.
              Trusted by thousands of travelers worldwide.
            </p>
            <div className="space-y-2 font-semibold">
              {[
                { icon: Mail, text: 'support.pravasatransworld@gmail.com', href: 'mailto:support.pravasatransworld@gmail.com' },
                { icon: Phone, text: '+91 84693 24000', href: 'tel:+918469324000' },
                { icon: MapPin, text: 'Mon–Fri, 9AM–6PM EST' },
              ].map(({ icon: Icon, text, href }) => (
                <div key={text} className="flex items-center gap-2.5 text-slate-500 text-sm">
                  <Icon className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  {href ? <a href={href} className="hover:text-brand-700 hover:underline break-all">{text}</a> : text}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-slate-900 font-extrabold text-base mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              {[
                ['/', 'Destinations'],
                ['/about', 'About'],
                ['/contact', 'Contact'],
                ['/login', 'Apply Now'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-slate-600 hover:text-brand-600 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-extrabold text-base mb-4">Services</h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              {SERVICES.map((s) => (
                <li key={s.key}>
                  <Link href={`/services/${s.slug}`} className="text-slate-600 hover:text-brand-600 transition-colors">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-extrabold text-base mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              {[['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service']].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-slate-600 hover:text-brand-600 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 mt-12 pt-8 text-sm text-center text-slate-400 font-bold">
          © {new Date().getFullYear()} Pravasa Transworld. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
