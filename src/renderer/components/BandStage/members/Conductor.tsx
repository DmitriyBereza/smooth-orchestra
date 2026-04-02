import React from 'react';

interface ConductorProps {
  playing: boolean;
}

export const Conductor: React.FC<ConductorProps> = ({ playing }) => (
  <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    {/* Head — solid dark circle with subtle highlight arc */}
    <circle cx="55" cy="38" r="12" fill="#0a0a14" />
    <path
      d="M 48 30 A 12 12 0 0 1 62 30"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Body silhouette — tailcoat with long coat tails */}
    <path
      d="M 45 50 L 40 52 L 38 90 L 35 140 L 42 140 L 48 100 L 55 90
         L 62 100 L 68 140 L 75 140 L 72 90 L 70 52 L 65 50 Z"
      fill="#0a0a14"
    />
    {/* Tailcoat tails */}
    <path
      d="M 38 90 L 30 145 L 38 142 L 42 100 Z"
      fill="#111122"
    />
    <path
      d="M 72 90 L 80 145 L 72 142 L 68 100 Z"
      fill="#111122"
    />
    {/* Gold edge-light on body outline (facing stage center / right side) */}
    <path
      d="M 65 50 L 70 52 L 72 90 L 80 145"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Left arm — resting at side */}
    <path
      d="M 45 55 L 32 80 L 30 105 L 34 106 L 38 82 L 46 60"
      fill="#111122"
    />

    {/* Baton arm — animated */}
    <g
      className={playing ? 'member-playing conductor-baton-arm' : 'member-idle conductor-baton-arm'}
      style={{ transformOrigin: '78px 74px' }}
    >
      {/* Right arm reaching up and out */}
      <path
        d="M 65 55 L 72 65 L 78 74 L 82 70 L 76 62 L 67 52"
        fill="#111122"
      />
      {/* Hand */}
      <circle cx="82" cy="70" r="3" fill="#0a0a14" />
      {/* Baton — brightest element, gold catching light */}
      <line
        x1="84" y1="68"
        x2="105" y2="42"
        stroke="#ffd700"
        strokeWidth="1.5"
        opacity="0.6"
        strokeLinecap="round"
      />
      {/* Baton tip — white/gold dot */}
      <circle cx="105" cy="42" r="1.5" fill="#fff8dc" opacity="0.8" />
    </g>

    {/* Legs */}
    <path
      d="M 48 138 L 46 165 L 42 170 L 50 170 L 52 145"
      fill="#0a0a14"
    />
    <path
      d="M 62 138 L 64 165 L 68 170 L 60 170 L 58 145"
      fill="#0a0a14"
    />

    {/* Shoes */}
    <rect x="40" y="168" width="12" height="4" rx="2" fill="#0a0a14" />
    <rect x="58" y="168" width="12" height="4" rx="2" fill="#0a0a14" />
  </svg>
);

export default Conductor;
