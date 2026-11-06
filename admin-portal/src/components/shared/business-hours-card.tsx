'use client';
import { useEffect, useState } from 'react';
import { Clock, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { updateBusinessHours } from '@/lib/api';

export interface DayHours { day: number; open: boolean; from: string; to: string }

// Monday first, the way the office reads its week. Sunday is day 0.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: day !== 0, from: '10:00', to: '19:00' }));

/** Opening hours in IST, day by day. Saving rewrites the hours line the website shows. */
export function BusinessHoursCard({ schedule, label, onSaved }: {
  schedule?: DayHours[];
  label: string;
  onSaved: (label: string, schedule: DayHours[]) => void;
}) {
  const [days, setDays] = useState<DayHours[]>(DEFAULT);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (schedule?.length === 7) setDays(schedule); }, [schedule]);

  const set = (day: number, patch: Partial<DayHours>) => setDays((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const invalid = days.some((d) => d.open && d.to <= d.from);

  const save = async () => {
    setSaving(true);
    try {
      const r = await updateBusinessHours(days);
      onSaved(r.data.data.businessHours, days);
      toast({ title: 'Business hours saved', description: r.data.data.businessHours, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6">
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Clock className="w-4 h-4" />Business hours (IST)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">The website shows: <span className="font-medium text-foreground">{label || 'Mon–Sat 10 AM – 7 PM IST'}</span></p>
      </div>
      <CardContent className="p-5 space-y-2">
        {ORDER.map((n) => {
          const d = days.find((x) => x.day === n)!;
          const bad = d.open && d.to <= d.from;
          return (
            <div key={n} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 w-36 cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={d.open} onChange={(e) => set(n, { open: e.target.checked })} />
                <span className={d.open ? 'text-foreground font-medium' : 'text-muted-foreground'}>{NAMES[n]}</span>
              </label>
              {d.open ? (
                <>
                  <Input type="time" className="h-8 w-32" value={d.from} onChange={(e) => set(n, { from: e.target.value })} aria-label={`${NAMES[n]} opens`} />
                  <span className="text-muted-foreground">to</span>
                  <Input type="time" className="h-8 w-32" value={d.to} onChange={(e) => set(n, { to: e.target.value })} aria-label={`${NAMES[n]} closes`} />
                  {bad && <span className="text-xs text-destructive">Closing must be after opening</span>}
                </>
              ) : <span className="text-muted-foreground">Closed</span>}
            </div>
          );
        })}
        <div className="pt-3">
          <Button onClick={save} disabled={saving || invalid || !days.some((d) => d.open)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
