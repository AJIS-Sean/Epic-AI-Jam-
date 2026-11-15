import { StuntCardId } from '../game/types';

interface SharpieSketchProps {
  cardId: StuntCardId;
}

export function SharpieSketch({ cardId }: SharpieSketchProps) {
  switch (cardId) {
    case 'exploding_ramps':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          {/* Slope & Ramp */}
          <path
            d="M 10 92 L 75 78 L 135 44 L 135 84 L 210 96"
            fill="none"
            stroke="#18181b"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Red Sharpie Fireball */}
          <path
            d="M 122 52 L 106 32 L 128 38 L 136 12 L 148 34 L 170 22 L 156 46 L 178 52 L 152 60"
            fill="none"
            stroke="#dc2626"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Rider silhouette flying */}
          <path
            d="M 142 22 L 154 14 M 148 18 L 158 26 M 136 28 L 160 22"
            stroke="#18181b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="151" cy="11" r="4" fill="#18181b" />
          {/* Sharpie arrow */}
          <path
            d="M 48 64 Q 88 38 118 28"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.2"
            strokeDasharray="5 4"
          />
        </svg>
      );

    case 'flaming_hoops':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          {/* Snow kicker */}
          <path
            d="M 12 94 Q 52 88 76 68 L 76 92 L 208 98"
            fill="none"
            stroke="#18181b"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Giant Hoop */}
          <ellipse
            cx="136"
            cy="46"
            rx="16"
            ry="28"
            fill="none"
            stroke="#18181b"
            strokeWidth="3.5"
          />
          {/* Red Sharpie Flames around ring */}
          <path
            d="M 125 22 L 118 10 L 132 16 L 139 4 L 145 18 L 156 12 L 148 25"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 122 66 L 114 78 L 128 73 M 148 68 L 158 78 L 146 75"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Flight arc */}
          <path
            d="M 78 62 Q 112 36 164 52"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.2"
            strokeDasharray="5 4"
          />
        </svg>
      );

    case 'fuel_barrels':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          <path d="M 10 92 L 210 92" stroke="#18181b" strokeWidth="3" strokeLinecap="round" />
          {/* Drums */}
          {[56, 110, 164].map((x, idx) => (
            <g key={x} transform={`translate(${x}, ${idx === 1 ? 46 : 52})`}>
              <rect
                x="-13"
                y="0"
                width="26"
                height="36"
                rx="3"
                fill="none"
                stroke="#dc2626"
                strokeWidth="3"
              />
              <line x1="-13" y1="12" x2="13" y2="12" stroke="#18181b" strokeWidth="2.5" />
              <line x1="-13" y1="24" x2="13" y2="24" stroke="#18181b" strokeWidth="2.5" />
            </g>
          ))}
          {/* Slalom carve line */}
          <path
            d="M 22 72 Q 56 32 84 68 T 138 66 T 194 74"
            fill="none"
            stroke="#18181b"
            strokeWidth="2.8"
            strokeDasharray="6 4"
          />
          {/* Boom star */}
          <path
            d="M 110 26 L 104 16 L 114 20 L 122 10 L 122 22 L 132 22 L 122 30"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'chopper_chase':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          {/* Helicopter body */}
          <ellipse cx="106" cy="36" rx="26" ry="13" fill="none" stroke="#18181b" strokeWidth="3.2" />
          <path
            d="M 80 36 L 44 30 L 40 20 M 44 30 L 40 40"
            fill="none"
            stroke="#18181b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Rotors */}
          <line x1="56" y1="16" x2="156" y2="16" stroke="#18181b" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="106" y1="16" x2="106" y2="23" stroke="#18181b" strokeWidth="3" />
          {/* Skids */}
          <path d="M 86 55 L 126 55 M 96 49 L 94 55 M 116 49 L 118 55" stroke="#18181b" strokeWidth="2.5" />
          {/* Red Spotlight Cone & Flares */}
          <path
            d="M 118 46 L 146 92 M 118 46 L 176 86"
            stroke="#dc2626"
            strokeWidth="2.2"
            strokeDasharray="4 4"
          />
          <path d="M 10 92 L 210 96" stroke="#18181b" strokeWidth="3" strokeLinecap="round" />
          <circle cx="158" cy="86" r="5" fill="none" stroke="#dc2626" strokeWidth="2.8" />
        </svg>
      );

    case 'mortar_barrage':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          <path d="M 10 94 L 210 94" stroke="#18181b" strokeWidth="3.2" strokeLinecap="round" />
          {/* Three erupting snow-fire geysers */}
          {[55, 112, 168].map((x, idx) => (
            <g key={x}>
              <path
                d={`M ${x - 14} 92 Q ${x - 6} 46 ${x - 18} ${idx === 1 ? 16 : 28}`}
                fill="none"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={`M ${x} 92 L ${x} ${idx === 1 ? 12 : 24}`}
                fill="none"
                stroke="#18181b"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={`M ${x + 14} 92 Q ${x + 6} 46 ${x + 18} ${idx === 1 ? 16 : 28}`}
                fill="none"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
      );

    case 'mega_wreck_gap':
      return (
        <svg viewBox="0 0 220 110" className="w-full h-24" aria-hidden="true">
          {/* Huge Ramp */}
          <path
            d="M 10 94 L 78 36 L 78 94"
            fill="none"
            stroke="#18181b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Wrecked Gondola Cabin */}
          <rect
            x="114"
            y="60"
            width="36"
            height="28"
            rx="4"
            transform="rotate(-12 132 74)"
            fill="none"
            stroke="#dc2626"
            strokeWidth="3.2"
          />
          <line x1="10" y1="94" x2="210" y2="96" stroke="#18181b" strokeWidth="3" />
          {/* Giant flight arc */}
          <path
            d="M 78 34 Q 132 2 188 78"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.8"
            strokeDasharray="6 4"
          />
          <circle cx="132" cy="14" r="4" fill="#18181b" />
        </svg>
      );
  }
}
