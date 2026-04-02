import React, { useId } from 'react';

interface SpotlightProps {
  x: number;
  color: string;
  intensity?: number;
  active: boolean;
}

const Spotlight: React.FC<SpotlightProps> = ({ x, color: _color, intensity = 1, active }) => {
  const id = useId();
  const gradientId = `spotlight-grad-${id}`;
  const violetGradientId = `spotlight-violet-${id}`;
  const filterId = `spotlight-blur-${id}`;

  const baseHalfWidth = 45;
  const coneTop = 0;
  const coneBottom = 210;

  // Primary amber cone points
  const primaryPoints = `${x},${coneTop} ${x - baseHalfWidth},${coneBottom} ${x + baseHalfWidth},${coneBottom}`;

  // Secondary violet bleed — wider and offset
  const violetHalfWidth = baseHalfWidth + 20;
  const violetPoints = `${x},${coneTop + 10} ${x - violetHalfWidth},${coneBottom + 10} ${x + violetHalfWidth},${coneBottom + 10}`;

  const opacity = active ? 0.65 * intensity : 0.05;

  return (
    <g>
      <defs>
        {/* Soft cinematic blur */}
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="12" />
        </filter>

        {/* Warm amber gradient */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.5)" />
          <stop offset="100%" stopColor="rgba(255, 215, 0, 0)" />
        </linearGradient>

        {/* Violet bleed gradient */}
        <linearGradient id={violetGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(155, 89, 182, 0.15)" />
          <stop offset="100%" stopColor="rgba(155, 89, 182, 0)" />
        </linearGradient>
      </defs>

      {/* Violet bleed (behind primary cone) */}
      <polygon
        points={violetPoints}
        fill={`url(#${violetGradientId})`}
        filter={`url(#${filterId})`}
        opacity={opacity * 0.6}
        style={{ transition: 'opacity 0.6s ease' }}
      />

      {/* Primary amber cone */}
      <polygon
        points={primaryPoints}
        fill={`url(#${gradientId})`}
        filter={`url(#${filterId})`}
        opacity={opacity}
        className={active ? 'spotlight' : undefined}
        style={{ transition: 'opacity 0.6s ease' }}
      />

      {/* Floor reflection — light pooling on mahogany */}
      {active && (
        <ellipse
          cx={x}
          cy={200}
          rx={50}
          ry={8}
          fill="rgba(255, 215, 0, 0.08)"
          style={{ transition: 'opacity 0.6s ease' }}
        />
      )}
    </g>
  );
};

export default Spotlight;
