import React from 'react';

interface MemberProps {
  playing: boolean;
}

export const Bassist: React.FC<MemberProps> = ({ playing }) => {
  return (
    <svg viewBox="0 0 120 180" width="120" height="180" xmlns="http://www.w3.org/2000/svg">
      <g className={playing ? 'member-playing' : 'member-idle'}>

        {/* Legs */}
        <rect x="44" y="124" width="11" height="38" rx="4" fill="#2a2a3e" />
        <rect x="60" y="124" width="11" height="38" rx="4" fill="#2a2a3e" />
        {/* Shoes */}
        <rect x="42" y="158" width="15" height="7" rx="3" fill="#1a1a2e" />
        <rect x="58" y="158" width="15" height="7" rx="3" fill="#1a1a2e" />

        {/* === Bass Guitar — larger/thicker than lead guitar === */}
        <g>
          {/* Bass neck — long, thick, extending up-left */}
          <rect x="22" y="42" width="8" height="62" rx="3" fill="#5a3a1a" transform="rotate(-20, 26, 73)" />
          {/* Headstock — larger */}
          <rect x="12" y="30" width="12" height="18" rx="4" fill="#3a2a1a" transform="rotate(-20, 18, 39)" />
          {/* Tuning pegs */}
          <circle cx="11" cy="32" r="2.5" fill="#888" />
          <circle cx="11" cy="39" r="2.5" fill="#888" />
          <circle cx="25" cy="28" r="2.5" fill="#888" />
          <circle cx="25" cy="35" r="2.5" fill="#888" />
          {/* Bass body — noticeably larger and rounder than lead guitar */}
          <ellipse cx="58" cy="114" rx="22" ry="18" fill="#3a2a1a" />
          <ellipse cx="56" cy="110" rx="17" ry="13" fill="#4a3520" />
          {/* Pickup — single, wider */}
          <rect x="48" y="108" width="16" height="4" rx="1.5" fill="#666" />
          {/* Bridge */}
          <rect x="50" y="120" width="12" height="3" rx="1" fill="#888" />
          {/* Strings — 4 thick bass strings */}
          <line x1="26" y1="50" x2="53" y2="108" stroke="#ccc" strokeWidth="0.8" />
          <line x1="28" y1="50" x2="55" y2="108" stroke="#ccc" strokeWidth="0.8" />
          <line x1="30" y1="50" x2="57" y2="108" stroke="#ccc" strokeWidth="0.8" />
          <line x1="32" y1="50" x2="59" y2="108" stroke="#ccc" strokeWidth="0.8" />
          {/* Strap button */}
          <circle cx="78" cy="100" r="2" fill="#888" />
        </g>

        {/* Torso / body — slightly wider, grounded stance */}
        <rect x="40" y="74" width="38" height="52" rx="8" fill="#2a2a3e" />
        {/* Red accent vest */}
        <rect x="46" y="77" width="26" height="46" rx="5" fill="#EF4444" />
        {/* Vest details — darker center line */}
        <line x1="59" y1="80" x2="59" y2="120" stroke="#c03030" strokeWidth="1.5" />

        {/* Neck */}
        <rect x="54" y="62" width="10" height="14" rx="4" fill="#d4a574" />

        {/* Head */}
        <circle cx="59" cy="54" r="16" fill="#d4a574" />
        {/* Eyes — calm, steady gaze */}
        <circle cx="53" cy="52" r="2" fill="#1a1a2e" />
        <circle cx="65" cy="52" r="2" fill="#1a1a2e" />
        {/* Slight smile — confident */}
        <path d="M54,59 Q59,63 64,59" fill="none" stroke="#a07050" strokeWidth="1.5" strokeLinecap="round" />
        {/* Beanie/cap */}
        <path d="M43,48 Q43,32 59,32 Q75,32 75,48" fill="#EF4444" />
        <rect x="43" y="46" width="32" height="5" rx="2" fill="#c03030" />

        {/* Left arm — on bass neck (static) */}
        <g>
          {/* Upper arm */}
          <rect x="32" y="78" width="10" height="26" rx="4" fill="#2a2a3e" transform="rotate(12, 37, 78)" />
          {/* Hand gripping neck */}
          <circle cx="28" cy="74" r="5.5" fill="#d4a574" />
        </g>

        {/* Right arm — plucking hand (animated) */}
        <g className="bassist-pluck-hand" style={{ transformOrigin: '65px 105px' }}>
          {/* Upper arm */}
          <rect x="76" y="82" width="10" height="22" rx="4" fill="#2a2a3e" transform="rotate(-15, 81, 82)" />
          {/* Forearm */}
          <rect x="72" y="100" width="8" height="14" rx="3" fill="#d4a574" transform="rotate(8, 76, 100)" />
          {/* Hand / fingers near strings */}
          <circle cx="70" cy="114" r="5.5" fill="#d4a574" />
          {/* Fingers extended for plucking */}
          <line x1="67" y1="112" x2="64" y2="116" stroke="#c49564" strokeWidth="2" strokeLinecap="round" />
          <line x1="70" y1="113" x2="68" y2="118" stroke="#c49564" strokeWidth="2" strokeLinecap="round" />
        </g>

      </g>
    </svg>
  );
};
