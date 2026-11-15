import { useEffect, useRef } from 'react';
import { DirectorVerdict, StoryboardCard } from '../game/types';
import { SharpieSketch } from './SharpieSketch';

interface StoryboardModalProps {
  verdict: DirectorVerdict;
  choices: StoryboardCard[];
  onSelectCard: (card: StoryboardCard) => void;
  onRetrySame: () => void;
}

export function StoryboardModal({
  verdict,
  choices,
  onSelectCard,
  onRetrySame,
}: StoryboardModalProps) {
  const isTakeOneBoring = verdict.takeNumber === 1;
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reshootRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus first storyboard card when modal opens for keyboard-only play
  useEffect(() => {
    cardRefs.current[0]?.focus();
  }, [verdict.takeNumber]);

  // Arrow keys, 1/2/3, and R keyboard navigation across cards and Reshoot button
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const currentIdx = cardRefs.current.findIndex((el) => el === document.activeElement);
      const isOnReshoot = document.activeElement === reshootRef.current;

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const next = currentIdx >= 0 ? (currentIdx + 1) % choices.length : 0;
        cardRefs.current[next]?.focus();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const prev =
          currentIdx >= 0 ? (currentIdx - 1 + choices.length) % choices.length : choices.length - 1;
        cardRefs.current[prev]?.focus();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        reshootRef.current?.focus();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (isOnReshoot || currentIdx < 0) {
          cardRefs.current[0]?.focus();
        }
      } else if (e.code === 'Digit1' && choices[0]) {
        e.preventDefault();
        onSelectCard(choices[0]);
      } else if (e.code === 'Digit2' && choices[1]) {
        e.preventDefault();
        onSelectCard(choices[1]);
      } else if (e.code === 'Digit3' && choices[2]) {
        e.preventDefault();
        onSelectCard(choices[2]);
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        onRetrySame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choices, onRetrySame, onSelectCard]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verdict-title"
    >
      <div className="w-full max-w-5xl rounded-xl bg-[#131720] border border-white/10 shadow-2xl p-6 md:p-8 my-auto">
        {/* Director Verdict Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 text-xs font-mono-tabular text-amber-400 tracking-wide">
              <span>TAKE {String(verdict.takeNumber).padStart(2, '0')} OF 03 WRAP</span>
              <span aria-hidden="true">/</span>
              <span>{verdict.ratingLabel}</span>
            </div>
            <h2
              id="verdict-title"
              className={`font-display text-3xl md:text-5xl font-extrabold tracking-tight ${
                isTakeOneBoring || !verdict.passed ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              {verdict.headline}
            </h2>
            <p className="text-slate-200 text-base md:text-lg leading-relaxed">
              {verdict.quote}
            </p>
          </div>

          {/* Clean unboxed run metrics */}
          <div className="grid grid-cols-3 gap-6 shrink-0 bg-[#0d1016] border border-white/10 rounded-lg px-5 py-4">
            <div>
              <div className="text-xs text-slate-400">Spectacle</div>
              <div className="font-mono-tabular text-xl font-bold text-white">
                {verdict.spectacleScore.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Top Speed</div>
              <div className="font-mono-tabular text-xl font-bold text-white">
                {verdict.stats.topSpeedKmh}{' '}
                <span className="text-xs font-normal text-slate-400">km/h</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Money Shots</div>
              <div className="font-mono-tabular text-xl font-bold text-amber-400">
                {verdict.stats.moneyShots}
              </div>
            </div>
          </div>
        </div>

        {/* Sharpie Storyboard Selection */}
        <div className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Choose the next stunt for Take {String(verdict.takeNumber + 1).padStart(2, '0')}
              </h3>
              <p className="text-sm text-slate-400">
                Use ← / → or 1–3 to pick a card · Enter to launch next take
              </p>
            </div>
            <button
              ref={reshootRef}
              type="button"
              onClick={onRetrySame}
              className="px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Reshoot Take {String(verdict.takeNumber).padStart(2, '0')} (R)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {choices.map((card, index) => (
              <button
                key={card.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                type="button"
                onClick={() => onSelectCard(card)}
                className="group relative text-left storyboard-card-paper text-zinc-900 rounded-md p-5 shadow-lg border-2 border-zinc-300 hover:-translate-y-1 hover:shadow-amber-500/20 hover:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-400 focus:border-amber-500 focus:-translate-y-1 transition-all duration-150 cursor-pointer"
              >
                {/* Masking tape piece at top */}
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 bg-amber-200/85 border border-amber-300/70 shadow-sm"
                  style={{ transform: `rotate(${index === 1 ? -2 : index === 0 ? 3 : -3}deg)` }}
                  aria-hidden="true"
                />

                <div className="flex items-center justify-between text-xs font-mono-tabular text-zinc-500 mb-2 pt-1">
                  <span>
                    [{index + 1}] {card.sceneTag}
                  </span>
                  <span className="text-red-600 font-bold">
                    {'★'.repeat(card.intensity)}
                  </span>
                </div>

                {/* Sharpie sketch */}
                <div className="my-2 border-y border-zinc-300/70 py-2">
                  <SharpieSketch cardId={card.id} />
                </div>

                <h4 className="font-marker text-xl text-zinc-900 leading-snug mt-3 group-hover:text-red-700 group-focus:text-red-700 transition-colors">
                  {card.title}
                </h4>

                <p className="mt-2 text-sm text-zinc-700 leading-snug">
                  {card.directorNote}
                </p>

                <div className="mt-4 pt-3 border-t border-zinc-300/80 flex items-center justify-between text-xs font-semibold text-red-700">
                  <span>{card.spectacleBonus}</span>
                  <span className="font-display text-zinc-900 group-hover:translate-x-0.5 transition-transform">
                    Add to Shoot →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
