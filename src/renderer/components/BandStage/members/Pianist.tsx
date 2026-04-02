import React from 'react';

interface PianistProps {
  playing: boolean;
}

export const Pianist: React.FC<PianistProps> = ({ playing }) => (
  <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    {/* Grand piano body — curved silhouette from the side */}
    <path
      d="M 20 105 Q 15 85 30 75 Q 50 60 85 65 L 95 68 L 98 105 L 95 108 Z"
      fill="#1a0f05"
    />
    {/* Piano lid — propped open as diagonal shape */}
    <path
      d="M 30 75 Q 50 60 85 65 L 88 62 Q 52 55 28 70 Z"
      fill="#111122"
    />
    {/* Lid prop stick */}
    <line x1="70" y1="63" x2="72" y2="80" stroke="#2a2a3e" strokeWidth="1" />
    {/* Lid highlight — gold stage light */}
    <path
      d="M 30 75 Q 50 60 85 65"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.15"
    />

    {/* Piano keys section */}
    <rect x="20" y="105" width="40" height="8" rx="1" fill="#1a0f05" />
    {/* White keys */}
    <rect x="22" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    <rect x="28" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    <rect x="34" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    <rect x="40" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    <rect x="46" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    <rect x="52" y="105" width="5" height="7" rx="0.5" fill="#e8e0d0" />
    {/* Black keys */}
    <rect x="26" y="105" width="3" height="4.5" rx="0.5" fill="#0a0a14" />
    <rect x="32" y="105" width="3" height="4.5" rx="0.5" fill="#0a0a14" />
    <rect x="44" y="105" width="3" height="4.5" rx="0.5" fill="#0a0a14" />
    <rect x="50" y="105" width="3" height="4.5" rx="0.5" fill="#0a0a14" />

    {/* Piano legs */}
    <rect x="22" y="113" width="3" height="22" fill="#1a0f05" />
    <rect x="92" y="108" width="3" height="27" fill="#1a0f05" />

    {/* Piano bench */}
    <rect x="55" y="130" width="22" height="5" rx="1" fill="#0a0a14" />
    <rect x="58" y="135" width="3" height="12" fill="#0a0a14" />
    <rect x="72" y="135" width="3" height="12" fill="#0a0a14" />

    {/* Seated figure — hunched forward toward keys */}
    {/* Head */}
    <circle cx="50" cy="82" r="9" fill="#0a0a14" />
    <path
      d="M 44 76 A 9 9 0 0 1 56 76"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Torso — hunched, head close to keys */}
    <path
      d="M 44 90 L 42 92 L 45 120 L 55 132 L 72 132 L 75 120 L 70 92 L 68 90
         Q 56 86 44 90 Z"
      fill="#0a0a14"
    />
    {/* Shoulder/back edge light */}
    <path
      d="M 68 90 L 70 92 L 75 120"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Upper arms */}
    <path d="M 44 92 L 38 100 L 36 106" fill="none" stroke="#111122" strokeWidth="5" strokeLinecap="round" />
    <path d="M 68 92 L 62 100 L 58 106" fill="none" stroke="#111122" strokeWidth="5" strokeLinecap="round" />

    {/* Hands on keys — animated */}
    <g
      className={playing ? 'member-playing pianist-hands' : 'member-idle pianist-hands'}
      style={{ transformOrigin: '60px 108px' }}
    >
      {/* Left hand */}
      <ellipse cx="36" cy="107" rx="4" ry="2.5" fill="#0a0a14" />
      {/* Right hand */}
      <ellipse cx="55" cy="107" rx="4" ry="2.5" fill="#0a0a14" />
    </g>

    {/* Legs — seated */}
    <path d="M 58 132 L 55 155 L 52 160" fill="none" stroke="#0a0a14" strokeWidth="5" strokeLinecap="round" />
    <path d="M 70 132 L 72 155 L 75 160" fill="none" stroke="#0a0a14" strokeWidth="5" strokeLinecap="round" />

    {/* Feet / pedal area */}
    <rect x="48" y="158" width="10" height="4" rx="2" fill="#0a0a14" />
    <rect x="70" y="158" width="10" height="4" rx="2" fill="#0a0a14" />
  </svg>
);

export default Pianist;
