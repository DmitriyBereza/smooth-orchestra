import React from 'react';

interface MemberProps {
  playing: boolean;
}

/**
 * Pianist — represents the Architect agent.
 * Accent color: #8B5CF6 (purple)
 *
 * Seated figure at a keyboard/piano, viewed from a slight angle.
 * When playing, the hands bob up and down on the keys.
 * When idle, hands rest on keys with a gentle sway.
 */
export const Pianist: React.FC<MemberProps> = ({ playing }) => {
  return (
    <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
      <g className={playing ? 'member-playing' : 'member-idle'}>

        {/* ---- Piano / Keyboard ---- */}
        {/* Keyboard body */}
        <rect x="8" y="118" width="104" height="20" rx="3" fill="#1a1205" />
        {/* Keyboard top surface (slight 3D feel) */}
        <rect x="8" y="116" width="104" height="6" rx="2" fill="#2a1f0e" />
        {/* Piano legs */}
        <rect x="14" y="138" width="6" height="30" rx="2" fill="#1a1205" />
        <rect x="100" y="138" width="6" height="30" rx="2" fill="#1a1205" />

        {/* White keys */}
        <g>
          <rect x="14" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="24" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="34" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="44" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="54" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="64" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="74" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="84" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
          <rect x="94" y="118" width="9" height="16" rx="1" fill="#e8e0d0" stroke="#c8c0b0" strokeWidth="0.5" />
        </g>
        {/* Black keys */}
        <g>
          <rect x="20" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
          <rect x="30" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
          <rect x="50" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
          <rect x="60" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
          <rect x="70" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
          <rect x="90" y="118" width="7" height="10" rx="1" fill="#1a1a2e" />
        </g>

        {/* ---- Piano bench / stool ---- */}
        <rect x="36" y="102" width="48" height="8" rx="3" fill="#3a3a4e" />
        {/* Bench legs */}
        <rect x="40" y="110" width="4" height="20" rx="1" fill="#2a2a3e" />
        <rect x="76" y="110" width="4" height="20" rx="1" fill="#2a2a3e" />

        {/* ---- Pianist body (seated) ---- */}
        {/* Torso with purple accent */}
        <rect x="44" y="64" width="32" height="40" rx="5" fill="#8B5CF6" />
        {/* Vest detail */}
        <rect x="57" y="64" width="4" height="34" rx="1" fill="#7C3AED" />

        {/* ---- Arms reaching to keyboard ---- */}
        {/* Left arm */}
        <line x1="46" y1="72" x2="36" y2="108" stroke="#d4a574" strokeWidth="5" strokeLinecap="round" />
        {/* Right arm */}
        <line x1="74" y1="72" x2="84" y2="108" stroke="#d4a574" strokeWidth="5" strokeLinecap="round" />

        {/* ---- Head ---- */}
        <circle cx="60" cy="46" r="17" fill="#d4a574" />
        {/* Hair */}
        <ellipse cx="60" cy="34" rx="15" ry="7" fill="#2a2a3e" />
        {/* Side hair */}
        <rect x="43" y="34" width="5" height="12" rx="2" fill="#2a2a3e" />
        <rect x="72" y="34" width="5" height="12" rx="2" fill="#2a2a3e" />
        {/* Eyes (looking down at keys) */}
        <ellipse cx="54" cy="47" rx="2" ry="1.5" fill="#1a1a2e" />
        <ellipse cx="66" cy="47" rx="2" ry="1.5" fill="#1a1a2e" />
        {/* Focused expression — slight line mouth */}
        <line x1="55" y1="54" x2="65" y2="54" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />

        {/* ---- Animated hands on keys ---- */}
        <g
          className="pianist-hands"
          style={{ transformOrigin: '60px 108px' }}
        >
          {/* Left hand */}
          <ellipse cx="36" cy="114" rx="7" ry="4" fill="#d4a574" />
          {/* Right hand */}
          <ellipse cx="84" cy="114" rx="7" ry="4" fill="#d4a574" />
        </g>

      </g>
    </svg>
  );
};
