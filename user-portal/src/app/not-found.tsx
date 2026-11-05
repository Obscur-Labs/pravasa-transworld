import Link from 'next/link';
import { Compass, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import NotFoundWhatsApp from '@/components/layout/NotFoundWhatsApp';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-24 bg-mesh">
        <div className="w-full max-w-lg text-center">
          <div className="w-14 h-14 bg-brand-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/10">
            <Compass className="w-7 h-7 text-white" />
          </div>

          <p className="text-7xl sm:text-8xl font-extrabold tracking-tight text-slate-900">404</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">This page took a wrong turn</h1>
          <p className="mt-2 text-slate-500 font-medium">
            The page you're looking for doesn't exist or may have moved. Let's get you back on track.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-brand-900 hover:bg-brand-800 text-white font-semibold shadow-md shadow-brand-600/10 border-0">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" /> Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold">
              <Link href="/countries">
                All destinations <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <NotFoundWhatsApp />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
