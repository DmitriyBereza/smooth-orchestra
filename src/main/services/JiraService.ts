import fs from 'fs';
import path from 'path';

export interface JiraConfig {
  siteUrl: string;    // e.g. "https://traceapp.atlassian.net"
  cloudId: string;    // e.g. "2fd214eb-c976-445f-a17a-77afb1195f67"
  projectKey: string; // e.g. "TRA"
  email: string;
  apiToken: string;
}

export interface JiraIssueInfo {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: string;
  issueType: string;
  url: string;
}

export class JiraService {
  private config: JiraConfig | null = null;
  private configPath: string;

  constructor(orchestraDir: string) {
    this.configPath = path.join(orchestraDir, 'jira.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (err) {
      console.error('[JiraService] Failed to load config:', err);
    }
  }

  saveConfig(config: JiraConfig): void {
    this.config = config;
    const tmp = `${this.configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, this.configPath);
    console.log('[JiraService] Config saved');
  }

  /** Returns config with masked token for the frontend */
  getPublicConfig(): (Omit<JiraConfig, 'apiToken'> & { hasToken: boolean }) | null {
    if (!this.config) return null;
    const { apiToken, ...rest } = this.config;
    return { ...rest, hasToken: !!apiToken };
  }

  isConfigured(): boolean {
    return !!(
      this.config?.siteUrl &&
      this.config?.email &&
      this.config?.apiToken &&
      this.config?.projectKey
    );
  }

  private getAuthHeader(): string {
    if (!this.config) throw new Error('Jira not configured');
    return 'Basic ' + Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
  }

  private getApiBase(): string {
    if (!this.config) throw new Error('Jira not configured');
    const site = this.config.siteUrl.startsWith('http') ? this.config.siteUrl : `https://${this.config.siteUrl}`;
    return `${site.replace(/\/$/, '')}/rest/api/3`;
  }

  private async request<T = unknown>(method: string, urlPath: string, body?: unknown): Promise<T> {
    const url = `${this.getApiBase()}${urlPath}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Jira API ${method} ${urlPath} → ${response.status}: ${text.slice(0, 200)}`);
    }

    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
  }

  async fetchIssues(jql: string, maxResults = 50): Promise<JiraIssueInfo[]> {
    const data = await this.request<any>('POST', '/search/jql', {
      jql,
      maxResults,
      fields: ['summary', 'description', 'status', 'issuetype'],
      expand: ['renderedFields'],
    });
    return (data.issues ?? []).map((issue: any) => this.mapIssue(issue));
  }

  async getIssue(key: string): Promise<JiraIssueInfo | null> {
    try {
      const params = new URLSearchParams({
        fields: 'summary,description,status,issuetype',
        expand: 'renderedFields',
      });
      const data = await this.request<any>('GET', `/issue/${key}?${params}`);
      return this.mapIssue(data);
    } catch {
      return null;
    }
  }

  async createIssue(summary: string, description: string): Promise<string> {
    if (!this.config) throw new Error('Jira not configured');
    const data = await this.request<any>('POST', '/issue', {
      fields: {
        project: { key: this.config.projectKey },
        summary,
        description: this.textToAdf(description),
        issuetype: { name: 'Task' },
      },
    });
    return data.key as string;
  }

  async transitionIssue(key: string, transitionId: string): Promise<void> {
    await this.request('POST', `/issue/${key}/transitions`, {
      transition: { id: transitionId },
    });
  }

  async getTransitions(key: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this.request<any>('GET', `/issue/${key}/transitions`);
    return (data.transitions ?? []).map((t: any) => ({ id: t.id as string, name: t.name as string }));
  }

  async addComment(key: string, text: string): Promise<void> {
    await this.request('POST', `/issue/${key}/comment`, {
      body: this.textToAdf(text),
    });
  }

  async startProgress(key: string): Promise<void> {
    try {
      const transitions = await this.getTransitions(key);
      const t = transitions.find(
        (t) => t.name === 'Start Progress' || t.name === 'In Progress',
      );
      if (t) await this.transitionIssue(key, t.id);
    } catch (err) {
      console.error(`[JiraService] startProgress(${key}) failed:`, err);
    }
  }

  async markDone(key: string): Promise<void> {
    try {
      const transitions = await this.getTransitions(key);
      const t = transitions.find((t) => t.name === 'Done');
      if (t) await this.transitionIssue(key, t.id);
    } catch (err) {
      console.error(`[JiraService] markDone(${key}) failed:`, err);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private mapIssue(issue: any): JiraIssueInfo {
    let description = '';
    if (issue.renderedFields?.description) {
      description = this.stripHtml(issue.renderedFields.description);
    } else if (issue.fields?.description) {
      description = this.adfToMarkdown(issue.fields.description);
    }

    return {
      id: issue.id as string,
      key: issue.key as string,
      summary: (issue.fields?.summary ?? '') as string,
      description: description.trim(),
      status: (issue.fields?.status?.name ?? '') as string,
      issueType: (issue.fields?.issuetype?.name ?? '') as string,
      url: `${this.config!.siteUrl.startsWith('http') ? this.config!.siteUrl : `https://${this.config!.siteUrl}`}/browse/${issue.key}`,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, t) => `## ${t}\n\n`)
      .replace(/<li[^>]*>(.*?)<\/li>/gi, (_, t) => `- ${t}\n`)
      .replace(/<p[^>]*>(.*?)<\/p>/gi, (_, t) => `${t}\n\n`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private adfToMarkdown(doc: any): string {
    if (!doc || doc.type !== 'doc') return '';
    return this.walkAdf(doc.content ?? []).trim();
  }

  private walkAdf(nodes: any[]): string {
    return nodes
      .map((node) => {
        switch (node.type) {
          case 'paragraph':
            return this.walkAdf(node.content ?? []) + '\n\n';
          case 'text': {
            let text = node.text ?? '';
            if (node.marks) {
              for (const mark of node.marks) {
                if (mark.type === 'strong') text = `**${text}**`;
                if (mark.type === 'em') text = `_${text}_`;
                if (mark.type === 'code') text = `\`${text}\``;
              }
            }
            return text;
          }
          case 'heading': {
            const level = node.attrs?.level ?? 2;
            return '#'.repeat(level) + ' ' + this.walkAdf(node.content ?? []) + '\n\n';
          }
          case 'bulletList':
            return (
              (node.content ?? [])
                .map((item: any) => '- ' + this.walkAdf(item.content ?? []).trim())
                .join('\n') + '\n\n'
            );
          case 'orderedList':
            return (
              (node.content ?? [])
                .map((item: any, i: number) => `${i + 1}. ` + this.walkAdf(item.content ?? []).trim())
                .join('\n') + '\n\n'
            );
          case 'listItem':
            return this.walkAdf(node.content ?? []);
          case 'codeBlock':
            return (
              '```' +
              (node.attrs?.language ?? '') +
              '\n' +
              this.walkAdf(node.content ?? []) +
              '\n```\n\n'
            );
          case 'inlineCard':
          case 'blockCard':
            return (node.attrs?.url ?? '') + ' ';
          case 'hardBreak':
            return '\n';
          case 'rule':
            return '---\n\n';
          default:
            return this.walkAdf(node.content ?? []);
        }
      })
      .join('');
  }

  private textToAdf(text: string): object {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return {
      type: 'doc',
      version: 1,
      content: paragraphs.map((p) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: p.replace(/\n/g, ' ').trim() }],
      })),
    };
  }
}
