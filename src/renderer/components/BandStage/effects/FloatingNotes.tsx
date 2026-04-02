import React from 'react';

interface FloatingNotesProps {
  x: number;
  y: number;
  color: string;
  active: boolean;
}

const NOTES = [
  { char: '\u266A', dx: -18, delay: 0 },
  { char: '\u266B', dx: 8, delay: 0.7 },
  { char: '\u266C', dx: -10, delay: 1.4 },
  { char: '\u266A', dx: 15, delay: 2.1 },
  { char: '\u266B', dx: -5, delay: 2.8 },
  { char: '\u266C', dx: 20, delay: 3.5 },
  { char: '\u266A', dx: -20, delay: 4.2 },
];

const FloatingNotes: React.FC<FloatingNotesProps> = ({ x, y, color, active }) => {
  if (!active) return null;

  return (
    <g>
      {NOTES.map((note, i) => (
        <text
          key={i}
          x={x + note.dx}
          y={y}
          fontSize={18}
          fill="#ffd700"
          opacity={0.8}
          className="floating-note"
          style={{
            animationDelay: `${note.delay}s`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        >
          {note.char}
        </text>
      ))}
    </g>
  );
};

export default FloatingNotes;
