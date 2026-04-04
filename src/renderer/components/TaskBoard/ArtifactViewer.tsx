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
        if (res.status === 404) return null; // artifact simply doesn't exist — hide quietly
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
          <span style={styles.loadingDot}>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.label}>{label}</span>
          <span style={styles.errorText}>{error}</span>
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
        <span style={styles.toggle}>{expanded ? '\u25B2' : '\u25BC'}</span>
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
                  Open in browser
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
    borderRadius: 6,
    border: '1px solid var(--border-color)',
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
    fontFamily: 'var(--font-sans)',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  toggle: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  loadingDot: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 11,
    color: 'var(--accent-red)',
  },
  content: {
    maxHeight: 400,
    overflowY: 'auto' as const,
    borderTop: '1px solid var(--border-color)',
    padding: '12px',
  },
  pre: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
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
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent-blue)',
    backgroundColor: 'transparent',
    border: '1px solid var(--accent-blue)',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
