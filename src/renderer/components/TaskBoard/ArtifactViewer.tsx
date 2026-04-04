import React, { useEffect, useState } from 'react';

interface ArtifactViewerProps {
  taskId: string;
  artifactType: string;
  label: string;
}

/**
 * Returns true if this artifact type produces HTML content that should
 * be rendered in a sandboxed iframe rather than displayed as plain text.
 */
export function isHtmlArtifact(artifactType: string): boolean {
  return artifactType.startsWith('brand-book-');
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ taskId, artifactType, label }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/artifacts/${encodeURIComponent(taskId)}/${encodeURIComponent(artifactType)}`)
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setContent(data?.content ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [taskId, artifactType]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.label}>{label}</span>
          <span style={styles.loadingDot}>loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.label}>{label}</span>
          <span style={styles.errorText}>error: {error}</span>
        </div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div style={styles.container}>
      <button
        type="button"
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={styles.label}>{label}</span>
        <span style={styles.toggle}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={isHtmlArtifact(artifactType) ? styles.htmlContent : styles.content}>
          {isHtmlArtifact(artifactType) ? (
            <>
              <iframe
                srcDoc={content}
                sandbox="allow-same-origin"
                style={styles.iframe}
                title={`${label} preview`}
              />
              <div style={styles.htmlActions}>
                <button
                  type="button"
                  style={styles.openButton}
                  onClick={() => {
                    const blob = new Blob([content], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                  }}
                >
                  open in browser
                </button>
              </div>
            </>
          ) : (
            <pre style={styles.pre}>{content}</pre>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-input)',
    backgroundColor: 'var(--bg-secondary)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    fontFamily: 'var(--font-mono)',
  },
  label: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  toggle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  loadingDot: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  errorText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--state-error)',
  },
  content: {
    maxHeight: '400px',
    overflowY: 'auto' as const,
    borderTop: '1px solid var(--border-color)',
    padding: '12px',
  },
  pre: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    lineHeight: 1.4,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  htmlContent: {
    borderTop: '1px solid var(--border-color)',
    padding: 0,
  },
  iframe: {
    width: '100%',
    height: 600,
    border: 'none',
    display: 'block',
  },
  htmlActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '8px 12px',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
  },
  openButton: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--brand-primary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 12px',
    cursor: 'pointer',
  },
};
