import { DirectorVerdict, StuntCardId, StoryboardCard } from './types';

export const STORYBOARD_DECK: StoryboardCard[] = [
  {
    id: 'exploding_ramps',
    sceneTag: 'STUNT ADD-ON A',
    title: 'Exploding Timber Kickers',
    directorNote: '"Wire C4 under every ramp lip! I want a fireball chasing his tail!"',
    spectacleBonus: '+Pyro Launch Boost & Fireball',
    intensity: 1,
  },
  {
    id: 'flaming_hoops',
    sceneTag: 'STUNT ADD-ON B',
    title: 'Blazing Rings of Fire',
    directorNote: '"Hang flaming steel hoops over the rollers. Thread the needle, kid!"',
    spectacleBonus: '+750 Hype per Hoop Cleared',
    intensity: 2,
  },
  {
    id: 'fuel_barrels',
    sceneTag: 'STUNT ADD-ON C',
    title: 'Volatile Drum Slalom',
    directorNote: '"Drop red fuel drums down the fall line! Carve close or blow sky high!"',
    spectacleBonus: '+Near-Miss Hype & Chain Blasts',
    intensity: 1,
  },
  {
    id: 'chopper_chase',
    sceneTag: 'STUNT ADD-ON D',
    title: 'Chopper Camera & Flares',
    directorNote: '"Get the stunt helicopter 30 feet off the snow! Drop red smoke flares!"',
    spectacleBonus: '+Live Chase Spotlight & Flares',
    intensity: 2,
  },
  {
    id: 'mortar_barrage',
    sceneTag: 'STUNT ADD-ON E',
    title: 'Avalanche Mortar Barrage',
    directorNote: '"Fire snow-cannon mortars across the ridge! Make it look like the mountain is erupting!"',
    spectacleBonus: '+Shockwave Geysers & Air Boost',
    intensity: 3,
  },
  {
    id: 'mega_wreck_gap',
    sceneTag: 'STUNT ADD-ON F',
    title: 'Gondola Wreckage Mega Gap',
    directorNote: '"Park a wrecked ski-lift tower mid-slope and build a 40-foot kicker right into it!"',
    spectacleBonus: '+Guaranteed Money Shot Jump',
    intensity: 3,
  },
];

export function pickStoryboardChoices(
  activeStunts: StuntCardId[],
  takeNumber: number
): StoryboardCard[] {
  const remaining = STORYBOARD_DECK.filter((c) => !activeStunts.includes(c.id));
  if (remaining.length <= 3) {
    // If nearly all are unlocked, return remaining plus top-ups from deck
    const pool = [...remaining];
    for (const card of STORYBOARD_DECK) {
      if (pool.length >= 3) break;
      if (!pool.some((p) => p.id === card.id)) {
        pool.push(card);
      }
    }
    return pool.slice(0, 3);
  }

  // On Take 1 -> 2, always surface exploding_ramps and flaming_hoops as great first spectacles
  if (takeNumber === 1) {
    const first = remaining.find((c) => c.id === 'exploding_ramps');
    const second = remaining.find((c) => c.id === 'flaming_hoops');
    const third = remaining.find((c) => c.id === 'fuel_barrels');
    if (first && second && third) return [first, second, third];
  }

  const shuffled = [...remaining].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export const MAX_TAKES = 3;

export function buildDirectorVerdict(params: {
  takeNumber: number;
  spectacleScore: number;
  requiredScore: number;
  topSpeedKmh: number;
  maxAirTime: number;
  tricksLanded: number;
  hoopsCleared: number;
  rampsExploded: number;
  moneyShots: number;
  cleanRun: boolean;
}): DirectorVerdict {
  const {
    takeNumber,
    spectacleScore,
    requiredScore,
    topSpeedKmh,
    maxAirTime,
    tricksLanded,
    hoopsCleared,
    rampsExploded,
    moneyShots,
    cleanRun,
  } = params;

  const stats = {
    topSpeedKmh,
    maxAirTime,
    tricksLanded,
    hoopsCleared,
    rampsExploded,
    moneyShots,
    cleanRun,
  };

  // Intended loop step 2:
  // "Complete the first take. Even a clean descent earns the director's verdict: 'Boring!'"
  if (takeNumber === 1) {
    return {
      takeNumber,
      headline: 'BORING!',
      quote: cleanRun
        ? '"Clean carving, zero explosions, zero fire. Are we shooting a ski brochure or an action blockbuster?! Pick a stunt card and give me ONE MORE TAKE!"'
        : '"You survived the mountain, barely, and still gave me nothing for the trailer! Grab a Sharpie card—we need real fireworks on Take 2!"',
      passed: false,
      spectacleScore,
      requiredScore,
      ratingLabel: 'Cut Room Floor',
      stats,
    };
  }

  const ratio = spectacleScore / Math.max(1, requiredScore);

  // Final Take (Take 03) Wrap Verdict
  if (takeNumber >= MAX_TAKES) {
    if (ratio >= 1.25 && moneyShots >= 1) {
      return {
        takeNumber,
        headline: "THAT'S A WRAP — BLOCKBUSTER!",
        quote:
          '"CUT! PRINT! CHECK! You just gave us the greatest snow stunt sequence in cinema history. See you at the premiere—I’m buying a bigger helicopter for the sequel!"',
        passed: true,
        spectacleScore,
        requiredScore,
        ratingLabel: 'IMAX Premiere',
        stats,
      };
    }
    if (ratio >= 0.85) {
      return {
        takeNumber,
        headline: "THAT'S A WRAP — BOX OFFICE HIT!",
        quote:
          '"The studio loves it, the insurance adjuster passed out, and the trailer is pure chaos. Principal photography is officially wrapped!"',
        passed: true,
        spectacleScore,
        requiredScore,
        ratingLabel: 'Theatrical Release',
        stats,
      };
    }
    return {
      takeNumber,
      headline: "THAT'S A WRAP — STRAIGHT TO STREAMING!",
      quote:
        '"The sun’s setting and we’re out of pyrotechnics! We’ll fix the rest in post-production—unless you want to reshoot Take 03 right now."',
      passed: false,
      spectacleScore,
      requiredScore,
      ratingLabel: 'Director’s Cut Needed',
      stats,
    };
  }

  if (ratio >= 1.35 && moneyShots >= 1) {
    return {
      takeNumber,
      headline: 'ABSOLUTE CINEMA!',
      quote:
        '"PRINT IT! Frame that slow-motion fireball and send it straight to IMAX! Now stack ONE LAST stunt for the Take 03 finale!"',
      passed: true,
      spectacleScore,
      requiredScore,
      ratingLabel: 'Box Office Gold',
      stats,
    };
  }

  if (ratio >= 1.0) {
    return {
      takeNumber,
      headline: "NOW WE'RE ROLLING!",
      quote:
        '"That actually raised my pulse! Great airtime and solid pyro—pick one more ridiculous stunt for the Take 03 finale!"',
      passed: true,
      spectacleScore,
      requiredScore,
      ratingLabel: 'Trailer Worthy',
      stats,
    };
  }

  return {
    takeNumber,
    headline: 'NEEDS MORE SPECTACLE!',
    quote:
      '"Close, stunt kid, but the studio executives fell asleep in the second act. Stack another stunt card and go all-out on Take 03!"',
    passed: false,
    spectacleScore,
    requiredScore,
    ratingLabel: 'Reshoot Required',
    stats,
  };
}
