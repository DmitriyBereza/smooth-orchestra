import React from 'react';

export const StageBackground: React.FC = () => (
  <g>
    <defs>
      {/* Wall gradient — deep noir blue-black */}
      <linearGradient id="wall-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#050510" />
        <stop offset="100%" stopColor="#020208" />
      </linearGradient>

      {/* Mahogany floor plank pattern */}
      <pattern id="floor-planks" x="0" y="0" width="120" height="20" patternUnits="userSpaceOnUse">
        <rect width="120" height="20" fill="#1a0f05" />
        <rect x="0" y="0" width="58" height="20" fill="#150c04" />
        {/* Grain lines */}
        <line x1="10" y1="0" x2="10" y2="20" stroke="#0d0805" strokeWidth="0.5" opacity="0.3" />
        <line x1="30" y1="0" x2="30" y2="20" stroke="#0d0805" strokeWidth="0.5" opacity="0.3" />
        <line x1="70" y1="0" x2="70" y2="20" stroke="#0d0805" strokeWidth="0.5" opacity="0.3" />
        <line x1="95" y1="0" x2="95" y2="20" stroke="#0d0805" strokeWidth="0.5" opacity="0.3" />
      </pattern>

      {/* Floor reflection gradient — warm stage light on polished wood */}
      <linearGradient id="floor-reflection" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,215,0,0.03)" />
        <stop offset="100%" stopColor="rgba(255,215,0,0)" />
      </linearGradient>

      {/* Left curtain gradient */}
      <linearGradient id="curtain-left-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#1a0a1a" />
        <stop offset="100%" stopColor="#1a0a1a" stopOpacity="0" />
      </linearGradient>

      {/* Right curtain gradient */}
      <linearGradient id="curtain-right-grad" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor="#1a0a1a" />
        <stop offset="100%" stopColor="#1a0a1a" stopOpacity="0" />
      </linearGradient>

      {/* Top vignette */}
      <linearGradient id="vignette-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0.6)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </linearGradient>

      {/* Corner vignettes */}
      <radialGradient id="vignette-corner-left" cx="0" cy="0" r="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
      <radialGradient id="vignette-corner-right" cx="1" cy="0" r="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>

      {/* Smoke haze filter */}
      <filter id="smoke-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
        <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
        <feComponentTransfer in="grey" result="faded">
          <feFuncA type="linear" slope="0.04" />
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="faded" mode="screen" />
      </filter>
    </defs>

    {/* 1. Wall */}
    <rect x="0" y="0" width="960" height="175" fill="url(#wall-grad)" />

    {/* 2. Floor — mahogany planks */}
    <rect x="0" y="175" width="960" height="85" fill="url(#floor-planks)" />
    <rect x="0" y="175" width="960" height="85" fill="url(#floor-reflection)" />

    {/* 3. Stage lip — decorative brass strip */}
    <rect x="0" y="175" width="960" height="2" fill="#ffd700" opacity="0.3" />
    <rect x="0" y="177" width="960" height="1" fill="#ffd700" opacity="0.15" />

    {/* 4. Left curtain */}
    <rect x="0" y="0" width="120" height="260" fill="url(#curtain-left-grad)" />
    <path d="M 20,0 Q 25,130 18,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 45,0 Q 50,120 42,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 70,0 Q 78,140 65,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 95,0 Q 100,125 90,258" stroke="#2a1a2a" strokeWidth="0.8" fill="none" opacity="0.15" />

    {/* 5. Right curtain */}
    <rect x="840" y="0" width="120" height="260" fill="url(#curtain-right-grad)" />
    <path d="M 940,0 Q 935,130 942,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 915,0 Q 910,120 918,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 890,0 Q 882,140 895,260" stroke="#2a1a2a" strokeWidth="1" fill="none" opacity="0.2" />
    <path d="M 865,0 Q 860,125 870,258" stroke="#2a1a2a" strokeWidth="0.8" fill="none" opacity="0.15" />

    {/* 6. Vignette — top and corners */}
    <rect x="0" y="0" width="960" height="60" fill="url(#vignette-top)" />
    <rect x="0" y="0" width="200" height="200" fill="url(#vignette-corner-left)" />
    <rect x="760" y="0" width="200" height="200" fill="url(#vignette-corner-right)" />

    {/* 7. Smoke overlay */}
    <rect x="0" y="0" width="960" height="260" filter="url(#smoke-filter)" fill="transparent" opacity="0.8" />
  </g>
);
