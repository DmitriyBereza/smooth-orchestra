import React from 'react';

interface BassistProps {
  playing: boolean;
}

export const Bassist: React.FC<BassistProps> = ({ playing }) => (
  <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    {/* === Upright Double Bass === */}

    {/* Double bass body — tall figure-8 / teardrop shape */}
    <path
      d="M 38 90 Q 28 95 26 110 Q 24 125 30 135 Q 34 142 42 145
         Q 50 148 56 145 Q 62 142 66 135 Q 72 125 70 110
         Q 68 95 58 90 Q 52 87 48 87 Q 42 87 38 90 Z"
      fill="#1a0f05"
    />
    {/* Upper bout (narrower waist and upper body) */}
    <path
      d="M 40 72 Q 34 76 33 84 Q 32 88 38 90
         Q 42 87 48 87 Q 52 87 58 90
         Q 64 88 63 84 Q 62 76 56 72 Q 50 68 48 68 Q 42 68 40 72 Z"
      fill="#1a0f05"
    />
    {/* F-holes — two S-curves */}
    <path
      d="M 40 105 Q 42 110 40 115"
      fill="none"
      stroke="#0a0a14"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <path
      d="M 56 105 Q 54 110 56 115"
      fill="none"
      stroke="#0a0a14"
      strokeWidth="1"
      strokeLinecap="round"
    />
    {/* Bridge */}
    <rect x="40" y="120" width="16" height="2" rx="0.5" fill="#2a2a3e" />
    {/* Strings — 4 thin vertical lines */}
    <line x1="43" y1="72" x2="43" y2="120" stroke="#2a2a3e" strokeWidth="0.4" />
    <line x1="46" y1="72" x2="46" y2="120" stroke="#2a2a3e" strokeWidth="0.4" />
    <line x1="50" y1="72" x2="50" y2="120" stroke="#2a2a3e" strokeWidth="0.4" />
    <line x1="53" y1="72" x2="53" y2="120" stroke="#2a2a3e" strokeWidth="0.4" />
    {/* Tailpiece */}
    <path d="M 44 122 L 48 140 L 52 122" fill="none" stroke="#2a2a3e" strokeWidth="0.6" />

    {/* Double bass neck — extending up */}
    <rect x="46" y="28" width="4" height="42" rx="1" fill="#1a0f05" />
    {/* Scroll / pegbox at top */}
    <path
      d="M 45 28 Q 44 22 48 20 Q 52 18 51 24 L 51 28"
      fill="#1a0f05"
    />
    {/* Tuning pegs */}
    <line x1="44" y1="26" x2="42" y2="25" stroke="#2a2a3e" strokeWidth="1" />
    <line x1="44" y1="30" x2="42" y2="31" stroke="#2a2a3e" strokeWidth="1" />
    <line x1="52" y1="26" x2="54" y2="25" stroke="#2a2a3e" strokeWidth="1" />
    <line x1="52" y1="30" x2="54" y2="31" stroke="#2a2a3e" strokeWidth="1" />

    {/* Gold edge highlight on bass body */}
    <path
      d="M 58 90 Q 68 95 70 110 Q 72 125 66 135"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.15"
    />

    {/* Endpin */}
    <line x1="48" y1="145" x2="48" y2="170" stroke="#2a2a3e" strokeWidth="1" />

    {/* === Standing Figure — leaning into the bass === */}

    {/* Head — dark silhouette, no cap */}
    <circle cx="72" cy="42" r="10" fill="#0a0a14" />
    <path
      d="M 66 34 A 10 10 0 0 1 78 34"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Torso — angled toward bass */}
    <path
      d="M 64 52 L 60 56 L 56 98 L 64 102 L 76 102 L 84 98 L 82 56 L 78 52 Z"
      fill="#0a0a14"
    />
    {/* Edge light on far side */}
    <path
      d="M 78 52 L 82 56 L 84 98"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Left arm — grips double bass neck near top */}
    <path
      d="M 64 56 L 58 50 L 52 42 L 50 38"
      fill="none"
      stroke="#111122"
      strokeWidth="5"
      strokeLinecap="round"
    />
    {/* Left hand gripping neck */}
    <circle cx="50" cy="38" r="3" fill="#0a0a14" />

    {/* Right arm — plucking hand, animated */}
    <g
      className={playing ? 'member-playing bassist-pluck-hand' : 'member-idle bassist-pluck-hand'}
      style={{ transformOrigin: '65px 105px' }}
    >
      {/* Forearm reaching to strings near bridge */}
      <path
        d="M 78 60 L 74 80 L 66 100 L 58 115"
        fill="none"
        stroke="#111122"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Hand near bridge / strings */}
      <circle cx="57" cy="116" r="3.5" fill="#0a0a14" />
    </g>

    {/* Legs — one foot forward (jazz bassist posture) */}
    <path
      d="M 64 100 L 58 130 L 54 155 L 50 165"
      fill="none"
      stroke="#0a0a14"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <path
      d="M 76 100 L 80 130 L 82 155 L 84 165"
      fill="none"
      stroke="#0a0a14"
      strokeWidth="5.5"
      strokeLinecap="round"
    />

    {/* Shoes */}
    <rect x="46" y="163" width="10" height="4" rx="2" fill="#0a0a14" />
    <rect x="80" y="163" width="10" height="4" rx="2" fill="#0a0a14" />
  </svg>
);

export default Bassist;
