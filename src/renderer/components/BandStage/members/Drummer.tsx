import React from 'react';

interface MemberProps {
  playing: boolean;
}

export const Drummer: React.FC<MemberProps> = ({ playing }) => {
  return (
    <svg viewBox="0 0 120 180" width="120" height="180" xmlns="http://www.w3.org/2000/svg">
      <g className={playing ? 'member-playing' : 'member-idle'}>

        {/* === Drum Kit === */}

        {/* Bass drum — large, front-facing */}
        <ellipse cx="60" cy="148" rx="28" ry="22" fill="#3a3a4e" />
        <ellipse cx="60" cy="148" rx="24" ry="18" fill="#2a2a3e" />
        {/* Green accent trim on bass drum */}
        <ellipse cx="60" cy="148" rx="24" ry="18" fill="none" stroke="#22C55E" strokeWidth="2.5" />
        {/* Bass drum logo circle */}
        <circle cx="60" cy="148" r="8" fill="none" stroke="#22C55E" strokeWidth="1" />

        {/* Snare drum — small ellipse in front */}
        <ellipse cx="54" cy="122" rx="12" ry="5" fill="#4a4a5e" />
        <rect x="42" y="122" width="24" height="8" rx="2" fill="#3a3a4e" />
        <ellipse cx="54" cy="130" rx="12" ry="4" fill="#4a4a5e" />
        {/* Snare stand */}
        <line x1="54" y1="130" x2="54" y2="142" stroke="#666" strokeWidth="2" />

        {/* Hi-hat — left side */}
        <line x1="24" y1="90" x2="24" y2="135" stroke="#666" strokeWidth="2" />
        <ellipse cx="24" cy="90" rx="10" ry="3" fill="#aaa" />
        <ellipse cx="24" cy="93" rx="10" ry="3" fill="#999" />

        {/* Cymbal — right side */}
        <line x1="96" y1="85" x2="96" y2="130" stroke="#666" strokeWidth="2" />
        <ellipse cx="96" cy="85" rx="12" ry="3" fill="#c0a030" />
        <circle cx="96" cy="85" r="2" fill="#a08020" />

        {/* Tom drum — right of snare */}
        <ellipse cx="74" cy="118" rx="10" ry="4" fill="#4a4a5e" />
        <rect x="64" y="118" width="20" height="10" rx="2" fill="#3a3a4e" />
        <ellipse cx="74" cy="128" rx="10" ry="4" fill="#4a4a5e" />

        {/* === Drummer (seated) === */}

        {/* Stool */}
        <rect x="52" y="108" width="16" height="4" rx="2" fill="#555" />
        <line x1="60" y1="112" x2="60" y2="130" stroke="#555" strokeWidth="3" />

        {/* Legs (seated, angled outward) */}
        <rect x="46" y="108" width="8" height="24" rx="3" fill="#2a2a3e" transform="rotate(10, 50, 108)" />
        <rect x="66" y="108" width="8" height="24" rx="3" fill="#2a2a3e" transform="rotate(-10, 70, 108)" />

        {/* Torso */}
        <rect x="44" y="68" width="32" height="42" rx="7" fill="#2a2a3e" />
        {/* Green accent shirt */}
        <rect x="48" y="71" width="24" height="36" rx="5" fill="#22C55E" />

        {/* Neck */}
        <rect x="55" y="56" width="10" height="14" rx="4" fill="#d4a574" />

        {/* Head */}
        <circle cx="60" cy="48" r="15" fill="#d4a574" />
        {/* Eyes */}
        <circle cx="54" cy="46" r="2" fill="#1a1a2e" />
        <circle cx="66" cy="46" r="2" fill="#1a1a2e" />
        {/* Focused expression — slight frown of concentration */}
        <line x1="56" y1="54" x2="64" y2="54" stroke="#a07050" strokeWidth="1.5" strokeLinecap="round" />
        {/* Headband */}
        <rect x="45" y="38" width="30" height="4" rx="2" fill="#22C55E" />

        {/* === Animated Arms with Drumsticks === */}

        {/* Right arm — hits snare/cymbal */}
        <g className="drummer-right-arm" style={{ transformOrigin: '70px 75px' }}>
          {/* Upper arm */}
          <rect x="74" y="72" width="8" height="20" rx="3" fill="#2a2a3e" transform="rotate(-30, 78, 72)" />
          {/* Forearm */}
          <rect x="82" y="86" width="7" height="16" rx="3" fill="#d4a574" transform="rotate(-45, 85, 86)" />
          {/* Hand */}
          <circle cx="90" cy="96" r="4" fill="#d4a574" />
          {/* Drumstick */}
          <line x1="88" y1="94" x2="74" y2="118" stroke="#c4a060" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Left arm — hits hi-hat/snare */}
        <g className="drummer-left-arm" style={{ transformOrigin: '50px 75px' }}>
          {/* Upper arm */}
          <rect x="38" y="72" width="8" height="20" rx="3" fill="#2a2a3e" transform="rotate(30, 42, 72)" />
          {/* Forearm */}
          <rect x="30" y="86" width="7" height="16" rx="3" fill="#d4a574" transform="rotate(45, 34, 86)" />
          {/* Hand */}
          <circle cx="30" cy="96" r="4" fill="#d4a574" />
          {/* Drumstick */}
          <line x1="32" y1="94" x2="40" y2="118" stroke="#c4a060" strokeWidth="2.5" strokeLinecap="round" />
        </g>

      </g>
    </svg>
  );
};
