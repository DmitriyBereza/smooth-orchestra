import fs from 'fs';
import path from 'path';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramService {
  private config: TelegramConfig | null = null;
  private configPath: string;

  constructor(orchestraDir: string) {
    this.configPath = path.join(orchestraDir, 'telegram.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (err) {
      console.error('[TelegramService] Failed to load config:', err);
    }
  }

  saveConfig(config: TelegramConfig): void {
    this.config = config;
    const tmp = `${this.configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, this.configPath);
    console.log('[TelegramService] Config saved');
  }

  getPublicConfig(): { chatId: string; hasToken: boolean } | null {
    if (!this.config) return null;
    return { chatId: this.config.chatId, hasToken: !!this.config.botToken };
  }

  isConfigured(): boolean {
    return !!(this.config?.botToken && this.config?.chatId);
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.config) throw new Error('Telegram not configured');

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Telegram API error ${response.status}: ${body.slice(0, 200)}`);
    }
  }

  async testConnection(): Promise<void> {
    await this.sendMessage('✅ Smooth Orchestra — Telegram integration connected!');
  }
}
