import React from 'react';

interface MemberProps {
  playing: boolean;
}

export const LeadGuitarist: React.FC<MemberProps> = ({ playing }) => {
  return (
    <svg viewBox="0 0 120 180" width="120" height="180" xmlns="http://www.w3.org/2000/svg">
      <g className={playing ? 'member-playing' : 'member-idle'}>

        {/* Legs */}
        <rect x="48" y="120" width="10" height="40" rx="3" fill="#2a2a3e" />
        <rect x="62" y="120" width="10" height="40" rx="3" fill="#2a2a3e" />
        {/* Shoes */}
        <rect x="46" y="156" width="14" height="6" rx="3" fill="#1a1a2e" />
        <rect x="60" y="156" width="14" height="6" rx="3" fill="#1a1a2e" />

        {/* Guitar — Les Paul silhouette */}
        <g>
          {/* Guitar neck — extending up-left */}
          <rect x="28" y="52" width="6" height="52" rx="2" fill="#5a3a1a" transform="rotate(-25, 31, 78)" />
          {/* Headstock */}
          <rect x="18" y="40" width="10" height="14" rx="3" fill="#3a2a1a" transform="rotate(-25, 23, 47)" />
          {/* Tuning pegs */}
          <circle cx="17" cy="42" r="2" fill="#888" />
          <circle cx="17" cy="48" r="2" fill="#888" />
          <circle cx="29" cy="38" r="2" fill="#888" />
          <circle cx="29" cy="44" r="2" fill="#888" />
          {/* Guitar body — Les Paul shape */}
          <ellipse cx="58" cy="108" rx="18" ry="14" fill="#3a2a1a" />
          <ellipse cx="56" cy="104" rx="14" ry="10" fill="#4a3520" />
          {/* Pickups */}
          <rect x="50" y="102" width="12" height="3" rx="1" fill="#666" />
          <rect x="50" y="108" width="12" height="3" rx="1" fill="#666" />
          {/* Bridge */}
          <rect x="52" y="114" width="8" height="2" rx="1" fill="#888" />
          {/* Strings (thin lines on neck) */}
          <line x1="30" y1="58" x2="56" y2="102" stroke="#ccc" strokeWidth="0.5" />
          <line x1="32" y1="58" x2="58" y2="102" stroke="#ccc" strokeWidth="0.5" />
        </g>

        {/* Torso / body */}
        <rect x="42" y="72" width="36" height="50" rx="8" fill="#2a2a3e" />
        {/* Orange accent shirt/jacket front */}
        <rect x="48" y="75" width="24" height="44" rx="5" fill="#F97316" />
        {/* Jacket lapels */}
        <polygon points="48,75 42,78 42,122 48,119" fill="#2a2a3e" />
        <polygon points="72,75 78,78 78,122 72,119" fill="#2a2a3e" />

        {/* Neck */}
        <rect x="55" y="60" width="10" height="14" rx="4" fill="#d4a574" />

        {/* Head */}
        <circle cx="60" cy="52" r="16" fill="#d4a574" />
        {/* Sunglasses — rock style */}
        <rect x="48" y="48" width="10" height="6" rx="2" fill="#1a1a2e" />
        <rect x="62" y="48" width="10" height="6" rx="2" fill="#1a1a2e" />
        <line x1="58" y1="51" x2="62" y2="51" stroke="#1a1a2e" strokeWidth="1.5" />
        {/* Hair */}
        <path d="M44,48 Q44,34 60,34 Q76,34 76,48" fill="#2a2a3e" />

        {/* Left arm — on guitar neck (static) */}
        <g>
          {/* Upper arm */}
          <rect x="34" y="76" width="10" height="24" rx="4" fill="#2a2a3e" transform="rotate(15, 39, 76)" />
          {/* Hand on frets */}
          <circle cx="30" cy="72" r="5" fill="#d4a574" />
        </g>

        {/* Right arm — strumming arm (animated) */}
        <g className="guitarist-strum-arm" style={{ transformOrigin: '55px 100px' }}>
          {/* Upper arm */}
          <rect x="76" y="80" width="10" height="22" rx="4" fill="#2a2a3e" transform="rotate(-20, 81, 80)" />
          {/* Forearm */}
          <rect x="70" y="96" width="8" height="16" rx="3" fill="#d4a574" transform="rotate(10, 74, 96)" />
          {/* Hand near strings */}
          <circle cx="68" cy="110" r="5" fill="#d4a574" />
        </g>

      </g>
    </svg>
  );
};
