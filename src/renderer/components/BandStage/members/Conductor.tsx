import React from 'react';

interface MemberProps {
  playing: boolean;
}

/**
 * Conductor — represents the Product Owner (PO) agent.
 * Accent color: #3B82F6 (blue)
 *
 * Standing figure in a formal blue jacket holding a conductor's baton.
 * When playing, the baton arm sweeps in a conducting pattern.
 * When idle, the figure gently sways.
 */
export const Conductor: React.FC<MemberProps> = ({ playing }) => {
  return (
    <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
      <g className={playing ? 'member-playing' : 'member-idle'}>

        {/* ---- Legs ---- */}
        {/* Left leg */}
        <rect x="46" y="128" width="10" height="36" rx="3" fill="#1e1e2e" />
        {/* Right leg */}
        <rect x="64" y="128" width="10" height="36" rx="3" fill="#1e1e2e" />
        {/* Left shoe */}
        <rect x="43" y="160" width="16" height="6" rx="3" fill="#111122" />
        {/* Right shoe */}
        <rect x="61" y="160" width="16" height="6" rx="3" fill="#111122" />

        {/* ---- Torso / Jacket (blue accent) ---- */}
        <rect x="40" y="68" width="40" height="62" rx="6" fill="#3B82F6" />
        {/* Jacket lapels / detail stripe */}
        <rect x="56" y="68" width="4" height="50" rx="1" fill="#2563EB" />
        {/* Jacket collar */}
        <rect x="44" y="66" width="32" height="8" rx="3" fill="#2a2a3e" />

        {/* ---- Left arm (resting at side) ---- */}
        <line x1="42" y1="74" x2="30" y2="110" stroke="#d4a574" strokeWidth="6" strokeLinecap="round" />
        {/* Left hand */}
        <circle cx="30" cy="112" r="4" fill="#d4a574" />

        {/* ---- Head ---- */}
        <circle cx="60" cy="50" r="18" fill="#d4a574" />
        {/* Hair / top of head */}
        <ellipse cx="60" cy="38" rx="16" ry="8" fill="#2a2a3e" />
        {/* Eyes */}
        <circle cx="54" cy="48" r="2" fill="#1a1a2e" />
        <circle cx="66" cy="48" r="2" fill="#1a1a2e" />
        {/* Slight confident smile */}
        <path d="M54 56 Q60 60 66 56" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* ---- Animated baton arm (right arm + baton) ---- */}
        <g
          className="conductor-baton-arm"
          style={{ transformOrigin: '78px 74px' }}
        >
          {/* Right upper arm */}
          <line x1="78" y1="74" x2="90" y2="58" stroke="#d4a574" strokeWidth="6" strokeLinecap="round" />
          {/* Right forearm */}
          <line x1="90" y1="58" x2="98" y2="42" stroke="#d4a574" strokeWidth="5" strokeLinecap="round" />
          {/* Right hand (grip) */}
          <circle cx="98" cy="42" r="3.5" fill="#d4a574" />
          {/* Baton */}
          <line x1="98" y1="42" x2="112" y2="18" stroke="#e8e0d0" strokeWidth="2.5" strokeLinecap="round" />
          {/* Baton tip */}
          <circle cx="112" cy="18" r="2" fill="#ffffff" />
        </g>

      </g>
    </svg>
  );
};
