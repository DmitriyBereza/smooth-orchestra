import React from 'react';

interface StatusBubbleProps {
  x: number;
  y: number;
  text: string;
  color: string;
  visible: boolean;
}

const FONT_SIZE = 11;
const PADDING_X = 10;
const PADDING_Y = 6;
const POINTER_SIZE = 6;

const StatusBubble: React.FC<StatusBubbleProps> = ({ x, y, text, color: _color, visible }) => {
  const textWidth = text.length * FONT_SIZE * 0.55;
  const boxWidth = textWidth + PADDING_X * 2;
  const boxHeight = FONT_SIZE + PADDING_Y * 2;
  const boxX = x - boxWidth / 2;
  const boxY = y - boxHeight - POINTER_SIZE;

  return (
    <g
      opacity={visible ? 1 : 0}
      style={{ transition: 'opacity 0.3s ease' }}
    >
      {/* Bubble background */}
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={4}
        ry={4}
        fill="#0f0f23"
        stroke="#ffd700"
        strokeWidth={0.5}
      />

      {/* Pointer triangle */}
      <polygon
        points={`${x - POINTER_SIZE},${boxY + boxHeight} ${x + POINTER_SIZE},${boxY + boxHeight} ${x},${boxY + boxHeight + POINTER_SIZE}`}
        fill="#0f0f23"
        stroke="#ffd700"
        strokeWidth={0.5}
      />
      {/* Cover the stroke line between rect and pointer */}
      <line
        x1={x - POINTER_SIZE + 1}
        y1={boxY + boxHeight}
        x2={x + POINTER_SIZE - 1}
        y2={boxY + boxHeight}
        stroke="#0f0f23"
        strokeWidth={1.5}
      />

      {/* Status text */}
      <text
        x={x}
        y={boxY + boxHeight / 2 + FONT_SIZE * 0.35}
        textAnchor="middle"
        fontSize={FONT_SIZE}
        fill="#e8dcc8"
        fontFamily="'Special Elite', 'Courier Prime', monospace"
      >
        {text}
      </text>
    </g>
  );
};

export default StatusBubble;
