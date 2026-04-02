import React from 'react';

interface DrummerProps {
  playing: boolean;
}

export const Drummer: React.FC<DrummerProps> = ({ playing }) => (
  <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
    {/* === Drum Kit === */}

    {/* Bass drum — dark circle */}
    <circle cx="60" cy="148" r="18" fill="#1a1a2e" />
    <circle cx="60" cy="148" r="18" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    <circle cx="60" cy="148" r="14" fill="#111122" />

    {/* Floor tom — left */}
    <ellipse cx="30" cy="125" rx="12" ry="5" fill="#1a1a2e" />
    <ellipse cx="30" cy="125" rx="12" ry="5" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    <rect x="18" y="125" width="24" height="12" fill="#1a1a2e" />

    {/* Rack tom — center */}
    <ellipse cx="60" cy="100" rx="10" ry="4" fill="#1a1a2e" />
    <ellipse cx="60" cy="100" rx="10" ry="4" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    <rect x="50" y="100" width="20" height="8" fill="#1a1a2e" />

    {/* Snare — right */}
    <ellipse cx="88" cy="115" rx="11" ry="4.5" fill="#1a1a2e" />
    <ellipse cx="88" cy="115" rx="11" ry="4.5" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    <rect x="77" y="115" width="22" height="7" fill="#1a1a2e" />

    {/* Hi-hat — left, two discs */}
    <ellipse cx="15" cy="95" rx="9" ry="2" fill="#2a2a3e" />
    <ellipse cx="15" cy="93" rx="9" ry="2" fill="#2a2a3e" />
    <ellipse cx="15" cy="93" rx="9" ry="2" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    {/* Hi-hat stand */}
    <line x1="15" y1="97" x2="15" y2="160" stroke="#2a2a3e" strokeWidth="1.5" />

    {/* Ride cymbal — right */}
    <ellipse cx="105" cy="88" rx="12" ry="2.5" fill="#2a2a3e" />
    <ellipse cx="105" cy="88" rx="12" ry="2.5" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    {/* Cymbal stand */}
    <line x1="105" y1="90" x2="105" y2="155" stroke="#2a2a3e" strokeWidth="1.5" />

    {/* Crash cymbal — center left */}
    <ellipse cx="38" cy="82" rx="10" ry="2" fill="#2a2a3e" />
    <ellipse cx="38" cy="82" rx="10" ry="2" fill="none" stroke="#ffd700" strokeWidth="0.5" opacity="0.2" />
    <line x1="38" y1="84" x2="38" y2="140" stroke="#2a2a3e" strokeWidth="1.5" />

    {/* === Seated Figure === */}

    {/* Head */}
    <circle cx="60" cy="52" r="10" fill="#0a0a14" />
    <path
      d="M 54 44 A 10 10 0 0 1 66 44"
      fill="none"
      stroke="#ffd700"
      strokeWidth="0.5"
      opacity="0.2"
    />

    {/* Torso */}
    <path
      d="M 50 62 L 48 64 L 46 95 L 55 98 L 65 98 L 74 95 L 72 64 L 70 62 Z"
      fill="#0a0a14"
    />

    {/* Stool */}
    <rect x="48" y="98" width="24" height="4" rx="2" fill="#111122" />
    <line x1="50" y1="102" x2="48" y2="130" stroke="#2a2a3e" strokeWidth="2" />
    <line x1="70" y1="102" x2="72" y2="130" stroke="#2a2a3e" strokeWidth="2" />

    {/* Legs — seated, spread to pedals */}
    <path d="M 52 98 L 45 120 L 40 140 L 38 148" fill="none" stroke="#0a0a14" strokeWidth="5" strokeLinecap="round" />
    <path d="M 68 98 L 75 120 L 78 140 L 80 148" fill="none" stroke="#0a0a14" strokeWidth="5" strokeLinecap="round" />

    {/* Feet */}
    <rect x="34" y="146" width="10" height="4" rx="2" fill="#0a0a14" />
    <rect x="76" y="146" width="10" height="4" rx="2" fill="#0a0a14" />

    {/* === Arms with Brushes === */}

    {/* Right arm — animated */}
    <g
      className={playing ? 'member-playing drummer-right-arm' : 'member-idle drummer-right-arm'}
      style={{ transformOrigin: '70px 75px' }}
    >
      <path
        d="M 70 64 L 78 72 L 85 80 L 90 88"
        fill="none"
        stroke="#111122"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Hand */}
      <circle cx="90" cy="88" r="3" fill="#0a0a14" />
      {/* Brush handle */}
      <line x1="92" y1="86" x2="98" y2="95" stroke="#2a2a3e" strokeWidth="1.2" strokeLinecap="round" />
      {/* Brush wire fan — 4 thin splayed lines */}
      <line x1="98" y1="95" x2="102" y2="100" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="98" y1="95" x2="100" y2="101" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="98" y1="95" x2="97" y2="101" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="98" y1="95" x2="95" y2="100" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
    </g>

    {/* Left arm — animated */}
    <g
      className={playing ? 'member-playing drummer-left-arm' : 'member-idle drummer-left-arm'}
      style={{ transformOrigin: '50px 75px' }}
    >
      <path
        d="M 50 64 L 42 72 L 35 80 L 28 88"
        fill="none"
        stroke="#111122"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Hand */}
      <circle cx="28" cy="88" r="3" fill="#0a0a14" />
      {/* Brush handle */}
      <line x1="26" y1="86" x2="20" y2="92" stroke="#2a2a3e" strokeWidth="1.2" strokeLinecap="round" />
      {/* Brush wire fan — 4 thin splayed lines */}
      <line x1="20" y1="92" x2="16" y2="97" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="20" y1="92" x2="18" y2="98" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="20" y1="92" x2="21" y2="98" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
      <line x1="20" y1="92" x2="23" y2="97" stroke="#2a2a3e" strokeWidth="0.4" opacity="0.6" />
    </g>
  </svg>
);

export default Drummer;
