import React from 'react';
import { AgentRole, ROLE_DISPLAY_NAMES, ROLE_COLORS, useStore } from '../../store/sessionStore';
import { StageBackground } from './StageBackground';

const MEMBER_POSITIONS = [
  { role: 'qa',        x: 40,  y: 70 },
  { role: 'developer', x: 200, y: 60 },
  { role: 'po',        x: 400, y: 45 },
  { role: 'architect', x: 590, y: 65 },
  { role: 'tech-lead', x: 770, y: 70 },
] as const;

export const BandStage: React.FC = () => {
  const agents = useStore((s) => s.agents);
  const session = useStore((s) => s.session);

  return (
    <div style={styles.container}>
      <div style={styles.stageWrapper}>
        <svg viewBox="0 0 960 260" style={styles.svg}>
          <StageBackground />
          {MEMBER_POSITIONS.map(({ role, x, y }) => {
            const agent = agents.find((a) => a.role === role);
            const isRunning = agent?.status === 'running';
            const color = ROLE_COLORS[role as AgentRole];
            const name = ROLE_DISPLAY_NAMES[role as AgentRole];

            return (
              <g key={role} transform={`translate(${x}, ${y})`}>
                {/* Glow when running */}
                {isRunning && (
                  <circle cx="60" cy="50" r="35" fill={color} opacity="0.15" />
                )}
                {/* Avatar circle */}
                <circle
                  cx="60"
                  cy="50"
                  r="22"
                  fill={isRunning ? color : '#333'}
                  opacity={isRunning ? 0.9 : 0.5}
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Role label */}
                <text
                  x="60"
                  y="90"
                  textAnchor="middle"
                  fill={isRunning ? '#fff' : '#888'}
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  stageWrapper: {
    position: 'relative',
    width: '100%',
  },
  svg: {
    width: '100%',
    maxHeight: 280,
    display: 'block',
  },
};
