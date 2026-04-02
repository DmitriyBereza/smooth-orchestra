import React from 'react';

interface StageBackgroundProps {
  width?: number;
  height?: number;
}

export const StageBackground: React.FC<StageBackgroundProps> = ({ width, height }) => {
  return (
    <svg
      viewBox="0 0 960 260"
      width={width}
      height={height}
      style={{ width: width ?? '100%', height: height ?? 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Dark jazz-club wall gradient */}
        <linearGradient id="stage-wall-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--stage-wall, #0a0a14)" />
          <stop offset="100%" stopColor="#050508" />
        </linearGradient>

        {/* Wooden plank floor pattern */}
        <pattern id="wood-planks" x="0" y="0" width="960" height="20" patternUnits="userSpaceOnUse">
          <rect width="960" height="20" fill="var(--stage-floor, #1a1205)" />
          <line x1="0" y1="0" x2="960" y2="0" stroke="#241a0a" strokeWidth="1" />
          <line x1="0" y1="10" x2="960" y2="10" stroke="#1f150a" strokeWidth="0.5" opacity="0.5" />
          <line x1="0" y1="19" x2="960" y2="19" stroke="#0f0a03" strokeWidth="0.5" opacity="0.3" />
        </pattern>

        {/* Left curtain gradient */}
        <linearGradient id="curtain-left-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--stage-curtain, #2d0a0a)" />
          <stop offset="100%" stopColor="var(--stage-curtain, #2d0a0a)" stopOpacity="0" />
        </linearGradient>

        {/* Right curtain gradient */}
        <linearGradient id="curtain-right-grad" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--stage-curtain, #2d0a0a)" />
          <stop offset="100%" stopColor="var(--stage-curtain, #2d0a0a)" stopOpacity="0" />
        </linearGradient>

        {/* Spotlight radial gradient */}
        <radialGradient id="spotlight-grad" cx="0.5" cy="0" r="0.7">
          <stop offset="0%" stopColor="var(--stage-spotlight, rgba(255,248,220,0.15))" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Wall background */}
      <rect width="960" height="260" fill="url(#stage-wall-grad)" />

      {/* Subtle spotlight on stage */}
      <ellipse cx="480" cy="0" rx="400" ry="200" fill="url(#spotlight-grad)" opacity="0.6" />

      {/* Stage floor */}
      <rect x="0" y="180" width="960" height="80" fill="url(#wood-planks)" />

      {/* Stage lip / front edge highlight */}
      <rect x="0" y="178" width="960" height="3" fill="#3a2a10" opacity="0.8" />
      <rect x="0" y="178" width="960" height="1" fill="#6b4f1f" opacity="0.5" />

      {/* Left curtain with drape curves */}
      <path
        d="M0,0 L80,0 Q70,40 75,80 Q80,120 70,160 Q65,200 72,260 L0,260 Z"
        fill="url(#curtain-left-grad)"
      />
      {/* Curtain fold highlights */}
      <path
        d="M40,0 Q35,50 42,100 Q48,150 38,200 Q34,230 40,260"
        fill="none"
        stroke="#3d1111"
        strokeWidth="1.5"
        opacity="0.4"
      />

      {/* Right curtain with drape curves */}
      <path
        d="M960,0 L880,0 Q890,40 885,80 Q880,120 890,160 Q895,200 888,260 L960,260 Z"
        fill="url(#curtain-right-grad)"
      />
      {/* Curtain fold highlights */}
      <path
        d="M920,0 Q925,50 918,100 Q912,150 922,200 Q926,230 920,260"
        fill="none"
        stroke="#3d1111"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
};
