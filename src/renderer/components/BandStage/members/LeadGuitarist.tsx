import React from 'react';

interface LeadGuitaristProps {
  playing: boolean;
}

export const LeadGuitarist: React.FC<LeadGuitaristProps> = ({ playing }) => (
  <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    {/* Entire figure leaning forward ~15 degrees */}
    <g transform="rotate(-8, 60, 170)">
      {/* Head — solid dark silhouette */}
      <circle cx="52" cy="38" r="11" fill="#0a0a14" />
      <path
        d="M 46 30 A 11 11 0 0 1 58 30"
        fill="none"
        stroke="#ffd700"
        strokeWidth="0.5"
        opacity="0.2"
      />

      {/* Torso — leaning forward */}
      <path
        d="M 42 48 L 38 52 L 36 95 L 44 98 L 55 95 L 66 98 L 74 95 L 72 52 L 68 48 Z"
        fill="#0a0a14"
      />
      {/* Gold edge-light on right side facing stage center */}
      <path
        d="M 68 48 L 72 52 L 74 95"
        fill="none"
        stroke="#ffd700"
        strokeWidth="0.5"
        opacity="0.2"
      />

      {/* Guitar body — dark with subtle pickups */}
      <ellipse cx="58" cy="108" rx="16" ry="12" fill="#1a1a2e" />
      <ellipse cx="58" cy="108" rx="12" ry="8" fill="#111122" />
      {/* Sound hole / pickup rectangles — barely visible */}
      <rect x="52" y="104" width="6" height="2.5" rx="0.5" fill="#2a2a3e" opacity="0.5" />
      <rect x="52" y="109" width="6" height="2.5" rx="0.5" fill="#2a2a3e" opacity="0.5" />
      {/* Bridge */}
      <rect x="54" y="115" width="8" height="1.5" rx="0.5" fill="#2a2a3e" />

      {/* Guitar neck */}
      <rect x="30" y="68" width="4" height="45" rx="1" fill="#1a1a2e" transform="rotate(-35, 32, 90)" />
      {/* Strings on neck — faint */}
      <line x1="31" y1="70" x2="18" y2="52" stroke="#2a2a3e" strokeWidth="0.3" opacity="0.5" />
      <line x1="33" y1="70" x2="20" y2="52" stroke="#2a2a3e" strokeWidth="0.3" opacity="0.5" />

      {/* Guitar headstock */}
      <rect x="12" y="46" width="8" height="10" rx="2" fill="#1a1a2e" transform="rotate(-35, 16, 51)" />

      {/* Left arm — on guitar neck (static) */}
      <path
        d="M 42 55 L 35 62 L 28 72 L 25 70 L 32 60 L 40 52"
        fill="#111122"
      />
      {/* Left hand gripping neck */}
      <circle cx="26" cy="71" r="3.5" fill="#0a0a14" />

      {/* Strum arm — animated */}
      <g
        className={playing ? 'member-playing guitarist-strum-arm' : 'member-idle guitarist-strum-arm'}
        style={{ transformOrigin: '55px 100px' }}
      >
        {/* Right arm reaching to strum area */}
        <path
          d="M 68 55 L 74 70 L 72 90 L 65 102"
          fill="none"
          stroke="#111122"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Right hand near strings */}
        <circle cx="64" cy="104" r="3.5" fill="#0a0a14" />
      </g>

      {/* Legs */}
      <path
        d="M 44 96 L 42 135 L 40 155 L 36 162 L 44 162 L 46 140"
        fill="#0a0a14"
      />
      <path
        d="M 64 96 L 66 135 L 68 155 L 72 162 L 64 162 L 62 140"
        fill="#0a0a14"
      />

      {/* Shoes */}
      <rect x="34" y="160" width="12" height="4" rx="2" fill="#0a0a14" />
      <rect x="62" y="160" width="12" height="4" rx="2" fill="#0a0a14" />
    </g>
  </svg>
);

export default LeadGuitarist;
