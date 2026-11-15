import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GamePhase, MovementTuning, RunTelemetry, StuntCardId } from '../game/types';
import { MAX_TAKES, STORYBOARD_DECK } from '../game/storyboards';

interface GameHudProps {
  phase: GamePhase;
  takeNumber: number;
  activeStunts: StuntCardId[];
  telemetry: RunTelemetry;
  tuning: MovementTuning;
  muted: boolean;
  onRetry: () => void;
  onToggleMute: () => void;
  onUpdateTuning: (next: MovementTuning) => void;
  onResetTuning: () => void;
  onTouchInput: (key: 'left' | 'right' | 'up' | 'down' | 'jump' | 'grab', active: boolean) => void;
}

export function GameHud({
  phase,
  takeNumber,
  activeStunts,
  telemetry,
  tuning,
  muted,
  onRetry,
  onToggleMute,
  onUpdateTuning,
  onResetTuning,
  onTouchInput,
}: GameHudProps) {
  const [dockOpen, setDockOpen] = useState(false);
  const [tuningTab, setTuningTab] = useState(false);
  const controlsTabRef = useRef<HTMLButtonElement | null>(null);
  const tuningTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        setDockOpen((prev) => {
          const next = !prev;
          if (!next && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          return next;
        });
      } else if (e.code === 'Escape' && dockOpen) {
        e.preventDefault();
        setDockOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dockOpen]);

  useEffect(() => {
    if (dockOpen) {
      requestAnimationFrame(() => {
        (tuningTab ? tuningTabRef.current : controlsTabRef.current)?.focus();
      });
    }
  }, [dockOpen, tuningTab]);

  const scorePct = Math.min(
    100,
    Math.round((telemetry.spectacleScore / Math.max(1, telemetry.requiredScore)) * 100)
  );
  const progressPct = Math.round(telemetry.distanceProgress * 100);

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const frames = Math.floor((sec % 1) * 24);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none">
      {/* Subtle Cinema Camera Viewfinder Corner Framing */}
      <div className="fixed top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white/25 pointer-events-none" />
      <div className="fixed top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white/25 pointer-events-none" />
      <div className="fixed bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white/25 pointer-events-none" />
      <div className="fixed bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white/25 pointer-events-none" />

      {/* Cinematic Money Shot Letterbox Bars */}
      <div
        className={`fixed inset-x-0 top-0 bg-[#0a0c10] transition-transform duration-200 pointer-events-none ${
          telemetry.isMoneyShotActive ? 'translate-y-0 h-10' : '-translate-y-full h-10'
        }`}
      />
      <div
        className={`fixed inset-x-0 bottom-0 bg-[#0a0c10] transition-transform duration-200 pointer-events-none ${
          telemetry.isMoneyShotActive ? 'translate-y-0 h-10' : 'translate-y-full h-10'
        }`}
      />

      {/* Top Viewfinder HUD Strip */}
      <div className="flex items-start justify-between p-4 md:p-5 gap-4">
        {/* Top-Left: Slate & Director Hype */}
        <div className="pointer-events-auto bg-[#11151d]/90 border border-white/15 rounded-lg px-4 py-3 min-w-[230px]">
          <div className="flex items-center justify-between gap-4 text-xs font-mono-tabular text-slate-300">
            <span className="font-bold text-amber-400">
              TAKE {String(takeNumber).padStart(2, '0')} / {String(MAX_TAKES).padStart(2, '0')}
            </span>
            <span aria-hidden="true">/</span>
            <span>{formatTimecode(telemetry.elapsedTime)}</span>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-xs text-slate-400">Director Spectacle</span>
            <span className="font-mono-tabular text-lg font-bold text-white">
              {telemetry.spectacleScore.toLocaleString()}
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {telemetry.requiredScore.toLocaleString()}
              </span>
            </span>
          </div>

          <div className="mt-1.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-150"
              style={{ width: `${scorePct}%` }}
            />
          </div>

          {activeStunts.length > 0 && (
            <div className="mt-2 text-[11px] text-slate-400 truncate max-w-[260px]">
              Active:{' '}
              {activeStunts
                .map((id) => STORYBOARD_DECK.find((c) => c.id === id)?.title)
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>

        {/* Center-Top: Countdown Slate or Stunt Callout */}
        <div className="flex flex-col items-center pt-1">
          {phase === 'countdown' && (
            <div className="bg-[#11151d]/95 border-2 border-white/80 rounded-lg px-8 py-4 text-center shadow-2xl">
              <div className="text-xs font-mono-tabular tracking-widest text-amber-400">
                SCENE 42 · TAKE {String(takeNumber).padStart(2, '0')}
              </div>
              <div className="font-display text-5xl font-extrabold text-white mt-1">
                {telemetry.countdownStep > 0 ? telemetry.countdownStep : 'ACTION!'}
              </div>
            </div>
          )}

          {phase === 'riding' && telemetry.isMoneyShotActive && (
            <div className="bg-red-600 text-white font-display text-xs font-extrabold tracking-widest px-3 py-1 rounded mb-2">
              MONEY SHOT · SLOW MOTION
            </div>
          )}

          {phase === 'riding' && telemetry.callout && (
            <div
              key={telemetry.callout.id}
              className="bg-[#11151d]/90 border border-amber-400/50 rounded-lg px-5 py-2 text-center shadow-lg"
            >
              <div className="font-display text-lg font-extrabold text-amber-400 tracking-wide">
                {telemetry.callout.label}
              </div>
              <div className="font-mono-tabular text-xs text-white">
                +{telemetry.callout.points.toLocaleString()} HYPE
                {telemetry.comboCount > 1 ? ` · ${telemetry.comboCount}x COMBO` : ''}
              </div>
            </div>
          )}

          {phase === 'riding' && telemetry.isAirborne && telemetry.airTime > 0.25 && (
            <div className="mt-2 font-mono-tabular text-xs font-bold text-white bg-[#11151d]/85 border border-white/15 rounded px-3 py-1">
              AIR {telemetry.airTime.toFixed(2)}s · ALT {telemetry.heightAboveGround.toFixed(1)}m
              {telemetry.activeSpinDeg >= 120 ? ` · SPIN ${telemetry.activeSpinDeg}°` : ''}
              {telemetry.activeFlipDeg >= 120 ? ` · FLIP ${telemetry.activeFlipDeg}°` : ''}
              {telemetry.isGrabbing ? ' · GRAB' : ''}
            </div>
          )}

          {/* Airborne Landing Safety Indicator (Color + Icon + Explicit Text + Angle Bar) */}
          {phase === 'riding' && telemetry.isAirborne && telemetry.airTime > 0.16 && (
            telemetry.landingState === 'unsafe' ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-2 bg-red-950/95 border-2 border-red-500 rounded-lg px-4 py-2 text-center shadow-xl"
              >
                <div className="flex items-center justify-center gap-2 font-display text-sm font-extrabold tracking-wide text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>UNSAFE LANDING · LEVEL BOARD</span>
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 text-[11px] font-mono-tabular text-red-300">
                  <span>{telemetry.landingOffsetDeg}° OFF-AXIS</span>
                  <span aria-hidden="true">·</span>
                  <span>WIPEOUT RISK</span>
                </div>
                <div className="mt-1.5 h-1.5 w-48 mx-auto bg-black/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.round((telemetry.landingOffsetDeg / 180) * 100))}%` }}
                  />
                </div>
              </div>
            ) : telemetry.landingState === 'sketchy' ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-2 bg-amber-950/95 border border-amber-400 rounded-lg px-4 py-1.5 text-center shadow-lg"
              >
                <div className="flex items-center justify-center gap-2 font-display text-xs font-extrabold tracking-wide text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>SKETCHY ANGLE · SQUARE UP ({telemetry.landingOffsetDeg}°)</span>
                </div>
                <div className="mt-1 h-1 w-40 mx-auto bg-black/45 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.round((telemetry.landingOffsetDeg / 180) * 100))}%` }}
                  />
                </div>
              </div>
            ) : telemetry.airTime > 0.35 &&
              (telemetry.activeSpinDeg >= 45 || telemetry.activeFlipDeg >= 45) ? (
              <div className="mt-2 bg-emerald-950/90 border border-emerald-400/70 rounded-lg px-3.5 py-1 text-center">
                <div className="flex items-center justify-center gap-1.5 font-mono-tabular text-[11px] font-bold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>LANDING ALIGNED · CLEAN ({telemetry.landingOffsetDeg}°)</span>
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Top-Right: Speedometer & Action Buttons */}
        <div className="pointer-events-auto flex items-start gap-2.5">
          <div className="bg-[#11151d]/90 border border-white/15 rounded-lg px-4 py-2.5 text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="font-mono-tabular text-2xl font-bold text-white">
                {telemetry.speedKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400">
              RUN {progressPct}%
              {telemetry.isBraking ? ' · BRAKING' : telemetry.isTucking ? ' · TUCK' : ''}
            </div>
            {telemetry.jumpCharge > 0.05 && (
              <div className="mt-1.5 h-1 w-24 bg-white/10 rounded-full overflow-hidden ml-auto">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${Math.round(telemetry.jumpCharge * 100)}%` }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRetry();
            }}
            title="Retry Take (R)"
            className="h-11 px-3.5 flex items-center gap-1.5 bg-[#11151d]/90 hover:bg-[#1a202c] border border-white/15 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Retry (R)</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            title={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="h-11 w-11 flex items-center justify-center bg-[#11151d]/90 hover:bg-[#1a202c] border border-white/15 rounded-lg text-white transition-colors cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Mobile Touch Controls (only on small touch screens while riding) */}
      {phase === 'riding' && (
        <div className="md:hidden flex items-center justify-between px-4 pb-20 pointer-events-auto">
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => onTouchInput('left', true)}
              onPointerUp={() => onTouchInput('left', false)}
              onPointerLeave={() => onTouchInput('left', false)}
              className="w-14 h-14 rounded-lg bg-[#11151d]/85 border border-white/20 text-white font-display font-bold active:bg-amber-500 active:text-black"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => onTouchInput('right', true)}
              onPointerUp={() => onTouchInput('right', false)}
              onPointerLeave={() => onTouchInput('right', false)}
              className="w-14 h-14 rounded-lg bg-[#11151d]/85 border border-white/20 text-white font-display font-bold active:bg-amber-500 active:text-black"
            >
              →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => onTouchInput('down', true)}
              onPointerUp={() => onTouchInput('down', false)}
              onPointerLeave={() => onTouchInput('down', false)}
              className="px-4 h-14 rounded-lg bg-[#11151d]/85 border border-white/20 text-xs font-bold text-white active:bg-red-500"
            >
              Brake
            </button>
            <button
              type="button"
              onPointerDown={() => onTouchInput('jump', true)}
              onPointerUp={() => onTouchInput('jump', false)}
              onPointerLeave={() => onTouchInput('jump', false)}
              className="px-5 h-14 rounded-lg bg-amber-500 text-black text-xs font-extrabold active:bg-amber-400"
            >
              Jump
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="pointer-events-auto flex flex-col items-center pb-3 px-4">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            setDockOpen((v) => !v);
          }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-t-lg bg-[#11151d]/95 border border-b-0 border-white/15 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>{dockOpen ? 'Hide Controls & Tuning (H)' : 'Controls & Movement Tuning (H)'}</span>
          {dockOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {dockOpen && (
          <div className="w-full max-w-[820px] bg-[#11151d]/95 border border-white/15 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                <button
                  ref={controlsTabRef}
                  type="button"
                  onClick={() => setTuningTab(false)}
                  onKeyDown={(e) => {
                    if (e.code === 'ArrowRight') {
                      e.preventDefault();
                      setTuningTab(true);
                    }
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    !tuningTab ? 'bg-amber-500 text-black font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Controls
                </button>
                <button
                  ref={tuningTabRef}
                  type="button"
                  onClick={() => setTuningTab(true)}
                  onKeyDown={(e) => {
                    if (e.code === 'ArrowLeft') {
                      e.preventDefault();
                      setTuningTab(false);
                    }
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    tuningTab ? 'bg-amber-500 text-black font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Movement Tuning
                </button>
              </div>

              {tuningTab && (
                <button
                  type="button"
                  onClick={onResetTuning}
                  className="text-xs text-slate-300 hover:text-white underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 px-1.5 py-0.5"
                >
                  Reset Defaults
                </button>
              )}
            </div>

            {!tuningTab ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-3 text-xs">
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">A / D or ← / →</div>
                  <div className="text-slate-300 mt-0.5">Carve &amp; Air Spin</div>
                </div>
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">W or ↑</div>
                  <div className="text-slate-300 mt-0.5">Speed Tuck / Flip</div>
                </div>
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">S or ↓</div>
                  <div className="text-slate-300 mt-0.5">Brake Skid / Backflip</div>
                </div>
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">Space</div>
                  <div className="text-slate-300 mt-0.5">Tap: Hop · Hold: High Jump</div>
                </div>
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">Shift / E</div>
                  <div className="text-slate-300 mt-0.5">Indy Board Grab</div>
                </div>
                <div>
                  <div className="font-mono-tabular font-bold text-amber-400">R / M / H</div>
                  <div className="text-slate-300 mt-0.5">Retry / Mute / Dock</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-3 text-xs">
                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Carve Edge Grip</span>
                    <span className="font-mono-tabular text-amber-400">{tuning.carveGrip.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={tuning.carveGrip}
                    onChange={(e) => onUpdateTuning({ ...tuning, carveGrip: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Turn Responsiveness</span>
                    <span className="font-mono-tabular text-amber-400">{tuning.turnSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={tuning.turnSpeed}
                    onChange={(e) => onUpdateTuning({ ...tuning, turnSpeed: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Jump Pop Force</span>
                    <span className="font-mono-tabular text-amber-400">{tuning.jumpPop.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={tuning.jumpPop}
                    onChange={(e) => onUpdateTuning({ ...tuning, jumpPop: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Slope Gravity</span>
                    <span className="font-mono-tabular text-amber-400">{tuning.gravityScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.05"
                    value={tuning.gravityScale}
                    onChange={(e) => onUpdateTuning({ ...tuning, gravityScale: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Top Speed Scale</span>
                    <span className="font-mono-tabular text-amber-400">{tuning.topSpeedScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.35"
                    step="0.05"
                    value={tuning.topSpeedScale}
                    onChange={(e) => onUpdateTuning({ ...tuning, topSpeedScale: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 cursor-pointer">
                  <span className="text-slate-200">Money Shot Slow-Mo</span>
                  <input
                    type="checkbox"
                    checked={tuning.moneyShotSlowMo}
                    onChange={(e) => onUpdateTuning({ ...tuning, moneyShotSlowMo: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
