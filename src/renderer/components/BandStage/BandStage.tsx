import React from 'react';
import { AgentRole, useStore } from '../../store/sessionStore';
import { StageBackground } from './StageBackground';
import { BandMember } from './BandMember';
import { SetlistBar } from './SetlistBar';
import './bandStage.css';

// Band member positions on stage (x, y) within the 960x260 viewBox
// Arrangement: Bassist (QA), Drummer (Dev), Conductor (PO center), Pianist (Arch), Guitarist (TL)
const MEMBER_POSITIONS: { role: AgentRole; x: number; y: number }[] = [
  { role: 'qa',        x: 60,  y: 60 },   // Bassist — far left
  { role: 'developer', x: 220, y: 50 },   // Drummer — left of center
  { role: 'po',        x: 410, y: 40 },   // Conductor — center stage
  { role: 'architect', x: 580, y: 55 },   // Pianist — right of center
  { role: 'tech-lead', x: 760, y: 60 },   // Lead Guitarist — far right
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
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  svg: {
    display: 'block',
    maxHeight: 240,
    width: '100%',
  },
};
