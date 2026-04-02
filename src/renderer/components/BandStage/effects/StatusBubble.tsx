import React from 'react';

interface StatusBubbleProps {
  text: string;
  visible: boolean;
  color: string;
  x: number;
  y: number;
}

const MAX_CHARS = 25;
const BUBBLE_HEIGHT = 22;
const BUBBLE_RX = 6;
const POINTER_SIZE = 5;
const PADDING_X = 8;
const FONT_SIZE = 10;

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS - 1) + '\u2026';
}

export const StatusBubble: React.FC<StatusBubbleProps> = ({
  text,
  visible,
  color,
  x,
  y,
}) => {
  const displayText = truncate(text);
  // Estimate width: ~6px per character + padding
  const estimatedWidth = Math.min(displayText.length * 6 + PADDING_X * 2, 120);
  const halfWidth = estimatedWidth / 2;

  const rectX = x - halfWidth;
  const rectY = y - BUBBLE_HEIGHT;

  // Triangle pointer at bottom center
  const pointerPath = `M${x - POINTER_SIZE},${y} L${x},${y + POINTER_SIZE} L${x + POINTER_SIZE},${y}`;

  return (
    <g
      className={visible ? 'status-bubble-visible' : undefined}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}
    >
      <rect
        x={rectX}
        y={rectY}
        width={estimatedWidth}
        height={BUBBLE_HEIGHT}
        rx={BUBBLE_RX}
        fill="#1e293b"
        stroke={color}
        strokeWidth={1}
      />
      <path d={pointerPath} fill="#1e293b" stroke={color} strokeWidth={1} />
      {/* Small rect to cover the stroke where pointer meets bubble */}
      <rect
        x={x - POINTER_SIZE + 1}
        y={y - 1}
        width={POINTER_SIZE * 2 - 2}
        height={2}
        fill="#1e293b"
      />
      <text
        x={x}
        y={rectY + BUBBLE_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f1f5f9"
        fontSize={FONT_SIZE}
        fontFamily="var(--font-sans)"
        style={{ pointerEvents: 'none' }}
      >
        {displayText}
      </text>
    </g>
  );
};
