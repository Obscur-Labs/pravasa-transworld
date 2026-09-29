'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Clock, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHasSession } from '@/lib/useHasSession';

export default function Hero() {
  const hasSession = useHasSession();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const visaTemplates = [
    { 
      country: 'Canada', 
      flag: '🇨🇦', 
      type: 'Tourist Visa', 
      applicant: 'Sarah Jenkins', 
      badge: '✓ Approved', 
      rate: '99%', 
      processing: '8–12 Days', 
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
      bgGradient: 'from-brand-50/10 to-indigo-50/5' 
    },
    { 
      country: 'United Kingdom', 
      flag: '🇬🇧', 
      type: 'Student Visa', 
      applicant: 'Alex Rivera', 
      badge: '⟳ In Review', 
      rate: '97%', 
      processing: '5–10 Days', 
      statusColor: 'bg-amber-50 text-amber-700 border-amber-200/50',
      bgGradient: 'from-indigo-50/10 to-brand-50/5' 
    },
    { 
      country: 'United States', 
      flag: '🇺🇸', 
      type: 'Business Visa', 
      applicant: 'Liam Chen', 
      badge: '✓ Approved', 
      rate: '98%', 
      processing: '10–15 Days', 
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
      bgGradient: 'from-brand-50/10 to-indigo-50/5' 
    },
    { 
      country: 'France', 
      flag: '🇪🇺', 
      type: 'Schengen Visa', 
      applicant: 'Emma Dubois', 
      badge: '✓ Approved', 
      rate: '99%', 
      processing: '3–7 Days', 
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
      bgGradient: 'from-amber-50/10 to-indigo-50/5' 
    }
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50/70 via-white to-brand-50/40 pt-20 pb-32">
      {/* Decorative large light glowing blobs with very slow & gentle animations */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-100/30 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-50/20 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-cyan-100/20 rounded-full blur-3xl pointer-events-none animate-float-reverse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Left Side Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-800 border border-brand-100/60 px-4 py-1.5 rounded-full text-sm font-semibold mb-8 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-brand-600 text-brand-600" />
              Trusted by 50,000+ travelers worldwide
            </div>

            <h1 className="text-5xl lg:text-7xl font-black leading-tight mb-6 text-slate-900 tracking-tight">
              Your Visa, <br />
              <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">Simplified.</span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-10 max-w-lg font-medium">
              Professional visa assistance from application to delivery. Upload documents once,
              track in real-time, and receive your visa hassle-free in a secure, transparent workspace.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Button
                size="lg"
                asChild
                className="group bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-600/10 hover:shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border-0 text-base font-semibold"
              >
                <Link href={hasSession ? '/apply' : '/login'}>
                  Apply For Visa
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-base transition-all duration-300 shadow-sm"
              >
                <a href="#how-it-works">How It Works</a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 font-medium">
              {[
                { icon: Shield, text: 'Secure & encrypted', color: 'text-brand-600' },
                { icon: Clock, text: 'Real-time tracking', color: 'text-brand-600' },
                { icon: CheckCircle, text: '98% success rate', color: 'text-brand-600' },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-2 group cursor-pointer">
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                  <span className="group-hover:text-slate-900 transition-colors">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Interactive Visa Mockup */}
          <div className="flex flex-col items-center lg:items-end justify-center">
            {/* Interactive Flag Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 justify-center lg:justify-start">
              {visaTemplates.map((t, i) => (
                <button
                  key={t.country}
                  onClick={() => setSelectedIndex(i)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${
                    selectedIndex === i
                      ? 'bg-brand-600 text-white shadow-md border border-brand-700'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <span>{t.flag}</span>
                  <span>{t.country}</span>
                </button>
              ))}
            </div>

            {/* Visa Card container */}
            <div className="relative pt-4">
              {/* Main Visa Card */}
              <div className="animate-float relative group">
                {/* Dynamic highlight glow behind the card */}
                <div className="absolute -inset-0.5 rounded-[2.2rem] bg-brand-500/5 opacity-40 blur-lg transition duration-1000" />
                
                <div className="w-[21rem] h-[13.5rem] bg-white/90 rounded-[2rem] p-6 relative overflow-hidden border border-brand-100 shadow-[0_20px_45px_rgba(48,149,192,0.06)] backdrop-blur-2xl">
                  {/* Dynamic Inner Gradient blending based on country */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${visaTemplates[selectedIndex].bgGradient} opacity-40 transition-all duration-500`} />
                  
                  {/* Rotating decorative overlay inside card */}
                  <div className="absolute -top-1/2 -right-1/2 w-72 h-72 bg-brand-500/5 rounded-full blur-2xl animate-spin-slow pointer-events-none" />

                  <div className="relative h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Visa Authorization</p>
                        <p className="text-slate-900 font-extrabold text-xl mt-0.5 tracking-tight">{visaTemplates[selectedIndex].type}</p>
                      </div>
                      <span className="text-4xl filter drop-shadow-sm select-none transform hover:scale-110 transition-transform duration-300 cursor-pointer">
                        {visaTemplates[selectedIndex].flag}
                      </span>
                    </div>

                    <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Applicant Name</p>
                        <p className="text-slate-800 font-extrabold text-sm tracking-wide">{visaTemplates[selectedIndex].applicant}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1">Live Status</p>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm transition-all duration-500 ${visaTemplates[selectedIndex].statusColor}`}>
                          <span className="relative flex h-1.5 w-1.5 mr-0.5">
                            {visaTemplates[selectedIndex].badge.includes('✓') && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            {visaTemplates[selectedIndex].badge.includes('⟳') && (
                              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                              visaTemplates[selectedIndex].badge.includes('✓') ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}></span>
                          </span>
                          {visaTemplates[selectedIndex].badge}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card 1: Success Rate */}
              <div className="absolute -bottom-6 -left-12 bg-white/95 rounded-2xl p-3.5 flex items-center gap-3 border border-slate-100 shadow-[0_10px_30px_rgba(48,149,192,0.05)] animate-float-reverse pointer-events-auto select-none">
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center border border-brand-100/50">
                  <Shield className="w-4.5 h-4.5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">{visaTemplates[selectedIndex].rate}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Success Rate</p>
                </div>
              </div>

              {/* Floating Card 2: Processing speed */}
              <div className="absolute -top-4 -right-10 bg-white/95 rounded-2xl p-3.5 flex items-center gap-3 border border-slate-100 shadow-[0_10px_30px_rgba(48,149,192,0.05)] animate-float pointer-events-auto select-none">
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center border border-brand-100/50">
                  <Clock className="w-4.5 h-4.5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">{visaTemplates[selectedIndex].processing}</p>
                  <p className="text-[10px] text-slate-500 font-bold">Processing Time</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row with subtle hovers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-24">
          {[
            { value: '50K+', label: 'Visas Processed' },
            { value: '40+', label: 'Destinations' },
            { value: '98%', label: 'Approval Rate' },
            { value: '24/7', label: 'Support Solutions' },
          ].map((s) => (
            <div 
              key={s.label} 
              className="bg-white rounded-3xl p-6 text-center border border-slate-100 hover:border-brand-100/70 hover:shadow-[0_12px_25px_rgba(48,149,192,0.03)] transition-all duration-300 shadow-sm"
            >
              <p className="text-3xl font-black text-brand-600 mb-1 tracking-tight">{s.value}</p>
              <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
