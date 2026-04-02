import React from 'react';
import { AgentRole, useStore, ROLE_COLORS } from '../../store/sessionStore';
import { Spotlight } from './effects/Spotlight';
import { FloatingNotes } from './effects/FloatingNotes';
import { StatusBubble } from './effects/StatusBubble';
import { Conductor } from './members/Conductor';
import { Pianist } from './members/Pianist';
import { LeadGuitarist } from './members/LeadGuitarist';
import { Drummer } from './members/Drummer';
import { Bassist } from './members/Bassist';

const MEMBER_COMPONENTS: Record<AgentRole, React.FC<{ playing: boolean }>> = {
  po: Conductor,
  architect: Pianist,
  'tech-lead': LeadGuitarist,
  developer: Drummer,
  qa: Bassist,
};

const ROLE_LABELS: Record<AgentRole, string> = {
  po: 'Conductor',
  architect: 'Pianist',
  'tech-lead': 'Guitarist',
  developer: 'Drummer',
  qa: 'Bassist',
};

interface BandMemberProps {
  role: AgentRole;
  x: number;
  y: number;
  onClick: () => void;
}

export const BandMember: React.FC<BandMemberProps> = ({ role, x, y, onClick }) => {
  const agents = useStore((s) => s.agents);
  const agentOutputs = useStore((s) => s.agentOutputs);

  const agent = agents.find((a) => a.role === role);
  const playing = agent?.status === 'running';
  const color = ROLE_COLORS[role];

  // Get latest output message for status bubble
  const outputs = agentOutputs[role] || [];
  const lastOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;
  const statusText = playing && lastOutput
    ? lastOutput.content.split('\n')[0]
    : ROLE_LABELS[role];

  const MemberSvg = MEMBER_COMPONENTS[role];

  // Member SVG viewBox is 120x180, we scale it to fit in the stage
  const memberWidth = 100;
  const memberHeight = 150;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      {/* Spotlight behind the member */}
      <Spotlight x={x + memberWidth / 2} color={color} active={playing} intensity={0.3} />

      {/* Floating notes above when playing */}
      <FloatingNotes
        active={playing}
        x={x + memberWidth / 2}
        y={y - 10}
        color={color}
      />

      {/* Status bubble */}
      <StatusBubble
        text={statusText}
        visible={playing}
        color={color}
        x={x + memberWidth / 2}
        y={y - 5}
      />

      {/* The band member SVG */}
      <g transform={`translate(${x}, ${y})`}>
        <svg
          viewBox="0 0 120 180"
          width={memberWidth}
          height={memberHeight}
          overflow="visible"
        >
          <MemberSvg playing={playing} />
        </svg>
      </g>

      {/* Role label below the member */}
      <text
        x={x + memberWidth / 2}
        y={y + memberHeight + 16}
        textAnchor="middle"
        fill={playing ? color : 'var(--text-muted)'}
        fontSize={11}
        fontWeight={playing ? 600 : 400}
        fontFamily="var(--font-sans)"
        style={{ transition: 'fill 0.3s ease' }}
      >
        {ROLE_LABELS[role]}
      </text>
    </g>
  );
};
