import { useEffect, useRef } from 'react';
import { Film, Play, RotateCcw } from 'lucide-react';
import { STORYBOARD_DECK } from '../game/storyboards';
import { DirectorVerdict, StuntCardId } from '../game/types';

interface EndingModalProps {
  finalVerdict: DirectorVerdict;
  takeHistory: DirectorVerdict[];
  activeStunts: StuntCardId[];
  onNewShoot: () => void;
  onReshootFinal: () => void;
}

export function EndingModal({
  finalVerdict,
  takeHistory,
  activeStunts,
  onNewShoot,
  onReshootFinal,
}: EndingModalProps) {
  const newShootBtnRef = useRef<HTMLButtonElement | null>(null);
  const reshootBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    newShootBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (document.activeElement === newShootBtnRef.current) {
          reshootBtnRef.current?.focus();
        } else {
          newShootBtnRef.current?.focus();
        }
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        onReshootFinal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onReshootFinal]);

  const totalSpectacle = takeHistory.reduce((sum, v) => sum + v.spectacleScore, 0);
  const peakSpeed = Math.max(...takeHistory.map((v) => v.stats.topSpeedKmh), finalVerdict.stats.topSpeedKmh);
  const totalMoneyShots = takeHistory.reduce((sum, v) => sum + v.stats.moneyShots, 0);
  const totalTricks = takeHistory.reduce((sum, v) => sum + v.stats.tricksLanded, 0);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ending-title"
    >
      <div className="w-full max-w-3xl rounded-xl bg-[#131720] border border-amber-400/35 shadow-2xl p-6 md:p-8 my-auto">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-amber-400 tracking-wide">
              <Film className="w-4 h-4" />
              <span>PRINCIPAL PHOTOGRAPHY COMPLETE</span>
              <span aria-hidden="true">/</span>
              <span>{finalVerdict.ratingLabel}</span>
            </div>
            <h2
              id="ending-title"
              className="font-display text-3xl md:text-4xl font-extrabold text-white tracking-tight"
            >
              {finalVerdict.headline}
            </h2>
            <p className="text-slate-200 text-base leading-relaxed max-w-2xl">
              {finalVerdict.quote}
            </p>
          </div>
        </div>

        {/* 3-Take Film Reel Breakdown */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {takeHistory.map((item) => (
            <div
              key={item.takeNumber}
              className="rounded-lg bg-[#0d1016] border border-white/10 px-4 py-3.5"
            >
              <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
                <span>TAKE {String(item.takeNumber).padStart(2, '0')}</span>
                <span className={item.passed ? 'text-amber-400' : 'text-red-400'}>
                  {item.ratingLabel}
                </span>
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {item.spectacleScore.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {item.stats.topSpeedKmh} km/h · {item.stats.tricksLanded} tricks · {item.stats.moneyShots} money shots
              </div>
            </div>
          ))}
        </div>

        {/* Cumulative Production Totals */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-white/[0.03] border border-white/10 px-5 py-4">
          <div>
            <div className="text-xs text-slate-400">Total Spectacle</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-400">
              {totalSpectacle.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Peak Speed</div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {peakSpeed} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Money Shots</div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {totalMoneyShots}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Tricks Landed</div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {totalTricks}
            </div>
          </div>
        </div>

        {activeStunts.length > 0 && (
          <div className="mt-4 text-xs text-slate-300">
            <span className="text-slate-400">Featured Stunt Reel: </span>
            {activeStunts
              .map((id) => STORYBOARD_DECK.find((c) => c.id === id)?.title)
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}

        {/* Keyboard-Navigable Finale Actions */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Use Arrow keys or Tab to switch · Enter to confirm
          </div>
          <div className="flex items-center gap-3">
            <button
              ref={reshootBtnRef}
              type="button"
              onClick={onReshootFinal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-sm font-medium text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reshoot Take 03 (R)</span>
            </button>

            <button
              ref={newShootBtnRef}
              type="button"
              onClick={onNewShoot}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-extrabold text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start New Shoot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
