import React from 'react';
import { useSocket } from './hooks/useSocket';
import { BandStage } from './components/BandStage/BandStage';
import { TaskBoard } from './components/TaskBoard/TaskBoard';
import { AgentPanel } from './components/AgentPanel/AgentPanel';
import { StatusBar } from './components/common/StatusBar';
import { LogViewer } from './components/common/LogViewer';

const App: React.FC = () => {
  // Initialize socket connection
  useSocket();

  return (
    <div style={styles.app}>
      {/* Top: Band stage visualization */}
      <BandStage />

      {/* Middle: Task board (left) + Agent output (right) */}
      <div style={styles.main}>
        <TaskBoard />
        <AgentPanel />
      </div>

      {/* Bottom: Event log (collapsible) */}
      <LogViewer />

      {/* Bottom bar: Status */}
      <StatusBar />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  main: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
};

export default App;
