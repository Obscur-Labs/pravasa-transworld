'use client';
import { CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';
import { PIPELINE_STAGES, stageIndexOf } from '@/types';
import type { ApplicationStatus } from '@/types';

const STEPS = PIPELINE_STAGES;

// The payment stage only reads as done once the payment is verified, so an older
// application reviewed before paying still shows its payment as outstanding.
function getStepState(status: ApplicationStatus, paid: boolean, stepIdx: number): 'done' | 'active' | 'pending' {
  const current = stageIndexOf(status);
  if (stepIdx === 1 && !paid) return current === 1 ? 'active' : 'pending';
  if (current > stepIdx) return 'done';
  if (current === stepIdx) return 'active';
  return 'pending';
}

interface Props {
  currentStatus: ApplicationStatus;
  paid?: boolean;
}

export default function StatusTimeline({ currentStatus, paid = false }: Props) {
  if (currentStatus === 'visa_rejected') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div>
          <p className="font-semibold text-red-700">Visa Rejected</p>
          <p className="text-sm text-red-600">Please contact support for more information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {STEPS.map((step, idx) => {
        const state = getStepState(currentStatus, paid, idx);
        const isLast = idx === STEPS.length - 1;
        return (
          <div key={step.label} className="flex items-start gap-4 relative">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border-2 ${
                state === 'done' ? 'bg-green-500 border-green-500' :
                state === 'active' ? 'bg-brand-900 border-brand-600' :
                'bg-white border-slate-200'
              }`}>
                {state === 'done' ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : state === 'active' ? (
                  <Clock className="w-4 h-4 text-white animate-pulse" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300" />
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-10 my-1 ${state === 'done' ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
            <div className={`pt-1.5 pb-2 ${!isLast ? 'mb-0' : ''}`}>
              <p className={`text-sm font-semibold ${
                state === 'done' ? 'text-green-700' :
                state === 'active' ? 'text-brand-700' :
                'text-slate-400'
              }`}>
                {step.label}
              </p>
              {state === 'active' && (
                <p className="text-xs text-brand-500 mt-0.5">In progress</p>
              )}
              {state === 'done' && (
                <p className="text-xs text-green-500 mt-0.5">Completed</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
