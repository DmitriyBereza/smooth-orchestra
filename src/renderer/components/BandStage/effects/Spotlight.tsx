import React, { useId } from 'react';

interface SpotlightProps {
  x: number;
  color: string;
  intensity?: number;
  active: boolean;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  x,
  color,
  intensity = 0.3,
  active,
}) => {
  const uid = useId();
  const gradientId = `spotlight-grad-${uid}`;
  const filterId = `spotlight-blur-${uid}`;

  const opacity = active ? Math.max(intensity, 0.4) + 0.15 : 0.12;

  // Cone from a point at the top down to a wide base on the stage floor
  const topX = x;
  const topY = 0;
  const baseHalfWidth = 60;
  const baseY = 300;

  const points = `${topX},${topY} ${x - baseHalfWidth},${baseY} ${x + baseHalfWidth},${baseY}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <polygon
        points={points}
        fill={`url(#${gradientId})`}
        filter={`url(#${filterId})`}
        opacity={opacity}
        className={active ? 'spotlight' : undefined}
        style={styles.cone}
      />
    </g>
  );
};

const styles: Record<string, React.CSSProperties> = {
  cone: {
    pointerEvents: 'none',
  },
};
