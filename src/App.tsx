import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Play, RotateCcw } from 'lucide-react';
import { SnowboardEngine } from './game/SnowboardEngine';
import { MAX_TAKES, pickStoryboardChoices } from './game/storyboards';
import {
  DirectorVerdict,
  GamePhase,
  MovementTuning,
  RunTelemetry,
  StoryboardCard,
  StuntCardId,
} from './game/types';
import { EndingModal } from './components/EndingModal';
import { GameHud } from './components/GameHud';
import { StoryboardModal } from './components/StoryboardModal';

const DEFAULT_TUNING: MovementTuning = {
  carveGrip: 1.0,
  turnSpeed: 1.0,
  jumpPop: 1.0,
  gravityScale: 1.0,
  topSpeedScale: 1.0,
  moneyShotSlowMo: true,
};

const INITIAL_TELEMETRY: RunTelemetry = {
  speedKmh: 0,
  airTime: 0,
  maxAirTime: 0,
  distanceProgress: 0,
  elapsedTime: 0,
  spectacleScore: 0,
  requiredScore: 1500,
  comboCount: 0,
  rampsHit: 0,
  hoopsCleared: 0,
  tricksLanded: 0,
  nearMisses: 0,
  moneyShotsCaptured: 0,
  isAirborne: false,
  isBraking: false,
  isTucking: false,
  isMoneyShotActive: false,
  jumpCharge: 0,
  activeSpinDeg: 0,
  activeFlipDeg: 0,
  landingState: 'grounded',
  landingOffsetDeg: 0,
  heightAboveGround: 0,
  isGrabbing: false,
  countdownStep: 3,
  callout: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SnowboardEngine | null>(null);
  const startBtnRef = useRef<HTMLButtonElement | null>(null);
  const wipeoutBtnRef = useRef<HTMLButtonElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [takeNumber, setTakeNumber] = useState(1);
  const [activeStunts, setActiveStunts] = useState<StuntCardId[]>([]);
  const [telemetry, setTelemetry] = useState<RunTelemetry>(INITIAL_TELEMETRY);
  const [verdict, setVerdict] = useState<DirectorVerdict | null>(null);
  const [takeHistory, setTakeHistory] = useState<DirectorVerdict[]>([]);
  const [cardChoices, setCardChoices] = useState<StoryboardCard[]>([]);
  const [tuning, setTuning] = useState<MovementTuning>(DEFAULT_TUNING);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const activeStuntsRef = useRef<StuntCardId[]>(activeStunts);
  activeStuntsRef.current = activeStunts;

  const takeNumberRef = useRef<number>(takeNumber);
  takeNumberRef.current = takeNumber;

  // Auto-focus primary CTA buttons for keyboard-only navigation
  useEffect(() => {
    if (phase === 'title') {
      requestAnimationFrame(() => startBtnRef.current?.focus());
    } else if (phase === 'wipeout') {
      requestAnimationFrame(() => wipeoutBtnRef.current?.focus());
    }
  }, [phase]);

  // Initialize Three.js SnowboardEngine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SnowboardEngine(container, {
      onPhaseChange: (nextPhase) => setPhase(nextPhase),
      onTelemetry: (t) => setTelemetry(t),
      onVerdict: (v) => {
        setVerdict(v);
        setTakeHistory((prev) =>
          [...prev.filter((item) => item.takeNumber !== v.takeNumber), v].sort(
            (a, b) => a.takeNumber - b.takeNumber
          )
        );
        if (v.takeNumber < MAX_TAKES) {
          setCardChoices(pickStoryboardChoices(activeStuntsRef.current, v.takeNumber));
        }
      },
      onContextLost: (lost) => setContextLost(lost),
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartFirstTake = useCallback(() => {
    setTakeNumber(1);
    setActiveStunts([]);
    setVerdict(null);
    setTakeHistory([]);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.startTake(1, []);
  }, []);

  const handleRetryTake = useCallback(() => {
    setVerdict(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.retryCurrentTake();
  }, []);

  const handleSelectStoryboardCard = useCallback((card: StoryboardCard) => {
    const nextTake = takeNumberRef.current + 1;
    const nextStunts = activeStuntsRef.current.includes(card.id)
      ? activeStuntsRef.current
      : [...activeStuntsRef.current, card.id];
    setTakeNumber(nextTake);
    setActiveStunts(nextStunts);
    setVerdict(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.startTake(nextTake, nextStunts);
  }, []);

  const handleToggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.unlockAudio();
    const next = !engine.isMuted();
    engine.setMuted(next);
    setMuted(next);
  }, []);

  const handleUpdateTuning = useCallback((next: MovementTuning) => {
    setTuning(next);
    engineRef.current?.setTuning(next);
  }, []);

  const handleResetTuning = useCallback(() => {
    setTuning(DEFAULT_TUNING);
    engineRef.current?.setTuning(DEFAULT_TUNING);
  }, []);

  const handleTouchInput = useCallback(
    (key: 'left' | 'right' | 'up' | 'down' | 'jump' | 'grab', active: boolean) => {
      engineRef.current?.setInput({ [key]: active });
    },
    []
  );

  // Keyboard bindings for carving, tucking, braking, jumping, grabs, and quick retry
  useEffect(() => {
    const mapKey = (
      code: string
    ): 'left' | 'right' | 'up' | 'down' | 'jump' | 'grab' | null => {
      switch (code) {
        case 'KeyA':
        case 'ArrowLeft':
          return 'left';
        case 'KeyD':
        case 'ArrowRight':
          return 'right';
        case 'KeyW':
        case 'ArrowUp':
          return 'up';
        case 'KeyS':
        case 'ArrowDown':
          return 'down';
        case 'Space':
          return 'jump';
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyE':
          return 'grab';
        default:
          return null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inUiControl =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'BUTTON' ||
          target.closest('[role="dialog"]') !== null);

      if (e.code === 'KeyM' && !e.repeat) {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (phase === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
          e.preventDefault();
          handleStartFirstTake();
        }
        return;
      }

      if (phase === 'wipeout') {
        if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') && !e.repeat) {
          e.preventDefault();
          handleRetryTake();
        }
        return;
      }

      if (phase === 'verdict') {
        return;
      }

      if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault();
        handleRetryTake();
        return;
      }

      // Let focused sliders/buttons inside the tuning dock handle arrow keys & Space/Enter naturally
      if (inUiControl) {
        return;
      }

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      const mapped = mapKey(e.code);
      if (mapped) {
        engineRef.current?.setInput({ [mapped]: true });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = mapKey(e.code);
      if (mapped) {
        engineRef.current?.setInput({ [mapped]: false });
      }
    };

    const onBlur = () => {
      engineRef.current?.setInput({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        grab: false,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleRetryTake, handleStartFirstTake, handleToggleMute, phase]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0d1015]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Context Lost Guard */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1015]/95 p-6">
          <div className="max-w-md rounded-xl bg-[#161b24] border border-white/15 p-6 text-center">
            <h2 className="font-display text-xl font-bold text-white">Graphics Context Paused</h2>
            <p className="mt-2 text-sm text-slate-300">
              WebGL rendering was interrupted. Reload or resume to continue your stunt take.
            </p>
          </div>
        </div>
      )}

      {/* Title Slate Overlay */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-30 flex items-center justify-start p-6 md:p-14 bg-gradient-to-r from-[#0d1015]/85 via-[#0d1015]/45 to-transparent pointer-events-none">
          <div className="pointer-events-auto max-w-lg rounded-xl bg-[#11151d]/95 border border-white/15 p-7 md:p-8 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-amber-400 tracking-wide">
              <Clapperboard className="w-4 h-4" />
              <span>ALPINE STUNT UNIT</span>
              <span aria-hidden="true">·</span>
              <span>SCENE 42</span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white tracking-tight mt-3 text-balance">
              One More Take
            </h1>

            <p className="mt-3 text-slate-300 text-base leading-relaxed">
              Drop down a steep alpine chute for an unhinged film director. Carve clean lines, hit
              pyrotechnic kickers, survive flaming hoops, and stick the landing in slow-motion
              money shots.
            </p>

            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <span className="font-mono-tabular text-amber-400 font-bold">A / D</span> Carve &amp; Spin
              </div>
              <div>
                <span className="font-mono-tabular text-amber-400 font-bold">Space</span> Tap Hop / Hold High
              </div>
              <div>
                <span className="font-mono-tabular text-amber-400 font-bold">W / S</span> Tuck &amp; Brake
              </div>
              <div>
                <span className="font-mono-tabular text-amber-400 font-bold">Shift / R</span> Grab &amp; Retry
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                ref={startBtnRef}
                type="button"
                onClick={handleStartFirstTake}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-extrabold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Take 01 (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active HUD (Countdown & Riding) */}
      {(phase === 'countdown' || phase === 'riding') && (
        <GameHud
          phase={phase}
          takeNumber={takeNumber}
          activeStunts={activeStunts}
          telemetry={telemetry}
          tuning={tuning}
          muted={muted}
          onRetry={handleRetryTake}
          onToggleMute={handleToggleMute}
          onUpdateTuning={handleUpdateTuning}
          onResetTuning={handleResetTuning}
          onTouchInput={handleTouchInput}
        />
      )}

      {/* Wipeout Quick Retry Slate */}
      {phase === 'wipeout' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="max-w-md w-full rounded-xl bg-[#131720] border border-red-500/40 p-7 text-center shadow-2xl">
            <div className="text-xs font-mono-tabular text-red-400 tracking-widest">
              CUT! · TAKE {String(takeNumber).padStart(2, '0')}
            </div>
            <h2 className="font-display text-3xl font-extrabold text-white mt-2">
              Wipeout on Set!
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              &ldquo;Somebody check if the board survived—actually, check the stunt kid too. Reset
              to top of the chute!&rdquo;
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                ref={wipeoutBtnRef}
                type="button"
                onClick={handleRetryTake}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-extrabold text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Take (R / Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Director Verdict -> Sharpie Storyboards (Takes 1-2) or Production Wrap Ending (Take 3) */}
      {phase === 'verdict' && verdict && verdict.takeNumber >= MAX_TAKES && (
        <EndingModal
          finalVerdict={verdict}
          takeHistory={takeHistory}
          activeStunts={activeStunts}
          onNewShoot={handleStartFirstTake}
          onReshootFinal={handleRetryTake}
        />
      )}

      {phase === 'verdict' && verdict && verdict.takeNumber < MAX_TAKES && (
        <StoryboardModal
          verdict={verdict}
          choices={cardChoices}
          onSelectCard={handleSelectStoryboardCard}
          onRetrySame={handleRetryTake}
        />
      )}
    </div>
  );
}
