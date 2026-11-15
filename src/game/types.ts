export type GamePhase =
  | 'title'
  | 'countdown'
  | 'riding'
  | 'wipeout'
  | 'verdict';

export type StuntCardId =
  | 'exploding_ramps'
  | 'flaming_hoops'
  | 'fuel_barrels'
  | 'chopper_chase'
  | 'mortar_barrage'
  | 'mega_wreck_gap';

export interface StoryboardCard {
  id: StuntCardId;
  sceneTag: string;
  title: string;
  directorNote: string;
  spectacleBonus: string;
  intensity: 1 | 2 | 3;
}

export interface StuntCallout {
  id: number;
  label: string;
  points: number;
  isMoneyShot?: boolean;
}

export type LandingSafetyState = 'grounded' | 'safe' | 'sketchy' | 'unsafe';

export interface RunTelemetry {
  speedKmh: number;
  airTime: number;
  maxAirTime: number;
  distanceProgress: number; // 0 to 1
  elapsedTime: number;
  spectacleScore: number;
  requiredScore: number;
  comboCount: number;
  rampsHit: number;
  hoopsCleared: number;
  tricksLanded: number;
  nearMisses: number;
  moneyShotsCaptured: number;
  isAirborne: boolean;
  isBraking: boolean;
  isTucking: boolean;
  isMoneyShotActive: boolean;
  jumpCharge: number; // 0 to 1
  activeSpinDeg: number;
  activeFlipDeg: number;
  landingState: LandingSafetyState;
  landingOffsetDeg: number;
  heightAboveGround: number;
  isGrabbing: boolean;
  countdownStep: number; // 3, 2, 1, 0 (ACTION!)
  callout: StuntCallout | null;
}

export interface MovementTuning {
  carveGrip: number;       // 0.6 to 1.6 (default 1.0)
  turnSpeed: number;       // 0.6 to 1.6 (default 1.0)
  jumpPop: number;         // 0.7 to 1.5 (default 1.0)
  gravityScale: number;    // 0.75 to 1.35 (default 1.0)
  topSpeedScale: number;   // 0.8 to 1.35 (default 1.0)
  moneyShotSlowMo: boolean;
}

export interface DirectorVerdict {
  takeNumber: number;
  headline: string;
  quote: string;
  passed: boolean;
  spectacleScore: number;
  requiredScore: number;
  ratingLabel: string;
  stats: {
    topSpeedKmh: number;
    maxAirTime: number;
    tricksLanded: number;
    hoopsCleared: number;
    rampsExploded: number;
    moneyShots: number;
    cleanRun: boolean;
  };
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;    // tuck / frontflip in air
  down: boolean;  // brake / backflip in air
  jump: boolean;  // spacebar
  grab: boolean;  // shift or E
}
