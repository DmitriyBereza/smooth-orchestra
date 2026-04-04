import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useAuthStore } from './store/authStore';
import { PipelineView } from './components/Pipeline/PipelineView';
import { TaskBoard } from './components/TaskBoard/TaskBoard';
import { AgentPanel } from './components/AgentPanel/AgentPanel';
import { StatusBar } from './components/common/StatusBar';
import { LogViewer } from './components/common/LogViewer';
import { LoginPage } from './components/Login/LoginPage';

type MobileTab = 'tasks' | 'agents' | 'logs';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

const App: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const loadToken = useAuthStore((s) => s.loadToken);
  const logout = useAuthStore((s) => s.logout);
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>('tasks');

  useEffect(() => {
    loadToken();
  }, []);

  useSocket();

  if (!token) {
    return <LoginPage />;
  }

  if (isMobile) {
    return (
      <div style={mobileStyles.app}>
        <PipelineView />

        <div style={mobileStyles.content}>
          {mobileTab === 'tasks' && (
            <div style={mobileStyles.panel}><TaskBoard /></div>
          )}
          {mobileTab === 'agents' && (
            <div style={mobileStyles.panel}><AgentPanel /></div>
          )}
          {mobileTab === 'logs' && (
            <div style={mobileStyles.logsWrapper}>
              <LogViewer forceExpanded />
            </div>
          )}
        </div>

        {/* Mobile tab bar */}
        <div style={mobileStyles.tabBar}>
          {([
            { id: 'tasks' as MobileTab, label: 'Tasks' },
            { id: 'agents' as MobileTab, label: 'Agents' },
            { id: 'logs' as MobileTab, label: 'Logs' },
          ]).map((tab) => (
            <button
              key={tab.id}
              style={{
                ...mobileStyles.tab,
                color: mobileTab === tab.id ? 'var(--brand-primary)' : 'var(--text-muted)',
                borderTopColor: mobileTab === tab.id ? 'var(--brand-primary)' : 'transparent',
              }}
              onClick={() => setMobileTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button
            style={{ ...mobileStyles.tab, color: 'var(--text-muted)' }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <PipelineView />

      <div style={styles.main}>
        <TaskBoard />
        <AgentPanel />
      </div>

      <LogViewer />
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

const mobileStyles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  panel: {
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  logsWrapper: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  tabBar: {
    display: 'flex',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderTop: '2px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
};

export default App;
