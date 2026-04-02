import React from 'react';
import { AgentRole, useStore } from '../../store/sessionStore';
import { StageBackground } from './StageBackground';
import { BandMember } from './BandMember';
import { SetlistBar } from './SetlistBar';
import './bandStage.css';

// Band member positions on stage (x, y) within the 960x260 viewBox
// Spread out for deep noir stage
const MEMBER_POSITIONS: { role: AgentRole; x: number; y: number }[] = [
  { role: 'qa',        x: 40,  y: 70 },
  { role: 'developer', x: 200, y: 60 },
  { role: 'po',        x: 400, y: 45 },
  { role: 'architect', x: 590, y: 65 },
  { role: 'tech-lead', x: 770, y: 70 },
];

export const BandStage: React.FC = () => {
  const setSelectedAgent = useStore((s) => s.setSelectedAgent);

  const handleMemberClick = (role: AgentRole) => {
    setSelectedAgent(role);
  };

  return (
    <div style={styles.container}>
      <svg
        viewBox="0 0 960 260"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={styles.svg}
      >
        <StageBackground />

        {MEMBER_POSITIONS.map(({ role, x, y }) => (
          <BandMember
            key={role}
            role={role}
            x={x}
            y={y}
            onClick={() => handleMemberClick(role)}
          />
        ))}
      </svg>

      <SetlistBar />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  svg: {
    display: 'block',
    maxHeight: 280,
    width: '100%',
  },
};
