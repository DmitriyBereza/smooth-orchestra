import React from 'react';

interface FloatingNotesProps {
  active: boolean;
  x: number;
  y: number;
  color: string;
}

const NOTES = [
  { symbol: '\u266A', dx: -12, delay: 0 },
  { symbol: '\u266B', dx: 8, delay: 0.5 },
  { symbol: '\u266A', dx: -5, delay: 1 },
  { symbol: '\u2669', dx: 14, delay: 1.5 },
  { symbol: '\u266B', dx: -10, delay: 2 },
];

export const FloatingNotes: React.FC<FloatingNotesProps> = ({
  active,
  x,
  y,
  color,
}) => {
  if (!active) {
    return null;
  }

  return (
    <g>
      {NOTES.map((note, i) => (
        <text
          key={i}
          x={x + note.dx}
          y={y}
          className="floating-note"
          fill={color}
          opacity={0.8}
          fontSize={13}
          fontFamily="var(--font-sans)"
          textAnchor="middle"
          style={{
            animationDelay: `${note.delay}s`,
            pointerEvents: 'none',
          }}
        >
          {note.symbol}
        </text>
      ))}
    </g>
  );
};
