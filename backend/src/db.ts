import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface User {
  id: number;
  name: string;
  email: string;
  instance_name: string;
  created_at: string;
}

export interface WhatsAppInstance {
  instance_name: string;
  user_id: number;
  status: 'disconnected' | 'connecting' | 'open';
  qr_code: string | null;
  phone_connected: string | null;
  updated_at: string;
}

export interface Campaign {
  id: number;
  user_id: number;
  name: string;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  interval_seconds: number;
  total_messages: number;
  sent_messages: number;
  failed_messages: number;
  pending_messages: number;
  created_at: string;
}

export interface QueueMessage {
  id: number;
  campaign_id: number;
  user_id: number;
  phone: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error_message: string | null;
  scheduled_at: number;
  sent_at: string | null;
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'automation.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    this.seedDefaultData();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        instance_name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_instances (
        instance_name TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'disconnected',
        qr_code TEXT,
        phone_connected TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'RUNNING',
        interval_seconds INTEGER DEFAULT 300,
        total_messages INTEGER DEFAULT 0,
        sent_messages INTEGER DEFAULT 0,
        failed_messages INTEGER DEFAULT 0,
        pending_messages INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        error_message TEXT,
        scheduled_at INTEGER NOT NULL,
        sent_at TEXT,
        FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_status_scheduled_id ON messages(status, scheduled_at, id);
      CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);
    `);
  }

  private seedDefaultData() {
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count === 0) {
      // Create a default multi-tenant team set so multiple users can test/use right out of the box
      const insertUser = this.db.prepare(
        'INSERT INTO users (name, email, instance_name) VALUES (?, ?, ?)'
      );
      const res1 = insertUser.run('Soham (Admin)', 'soham@ropmitra.com', 'ropmitra_inst_1');
      const res2 = insertUser.run('Sales Team A', 'sales.a@ropmitra.com', 'ropmitra_inst_2');
      const res3 = insertUser.run('Outreach Lead', 'outreach@ropmitra.com', 'ropmitra_inst_3');

      const insertInst = this.db.prepare(
        'INSERT OR IGNORE INTO whatsapp_instances (instance_name, user_id, status) VALUES (?, ?, ?)'
      );
      insertInst.run('ropmitra_inst_1', res1.lastInsertRowid, 'disconnected');
      insertInst.run('ropmitra_inst_2', res2.lastInsertRowid, 'disconnected');
      insertInst.run('ropmitra_inst_3', res3.lastInsertRowid, 'disconnected');
    }
  }

  public getDb(): Database.Database {
    return this.db;
  }

  // Users
  public getUsers(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY id ASC').all() as User[];
  }

  public getUserById(id: number): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  public createUser(name: string, email: string, instanceName: string): User {
    const stmt = this.db.prepare('INSERT INTO users (name, email, instance_name) VALUES (?, ?, ?)');
    const res = stmt.run(name, email, instanceName);
    this.db.prepare('INSERT OR IGNORE INTO whatsapp_instances (instance_name, user_id, status) VALUES (?, ?, ?)').run(
      instanceName,
      res.lastInsertRowid,
      'disconnected'
    );
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid) as User;
  }

  // Instances
  public getInstance(instanceName: string): WhatsAppInstance | undefined {
    return this.db.prepare('SELECT * FROM whatsapp_instances WHERE instance_name = ?').get(instanceName) as WhatsAppInstance | undefined;
  }

  public updateInstanceStatus(
    instanceName: string,
    status: 'disconnected' | 'connecting' | 'open',
    qrCode: string | null = null,
    phoneConnected: string | null = null
  ) {
    if (status === 'disconnected') {
      this.db.prepare(`
        UPDATE whatsapp_instances
        SET status = ?, qr_code = ?, phone_connected = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE instance_name = ?
      `).run(status, qrCode, instanceName);
    } else {
      this.db.prepare(`
        UPDATE whatsapp_instances
        SET status = ?, qr_code = ?, phone_connected = COALESCE(?, phone_connected), updated_at = CURRENT_TIMESTAMP
        WHERE instance_name = ?
      `).run(status, qrCode, phoneConnected, instanceName);
    }
  }

  // Campaigns
  public getCampaigns(userId?: number): Campaign[] {
    if (userId) {
      return this.db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY id DESC').all(userId) as Campaign[];
    }
    return this.db.prepare('SELECT * FROM campaigns ORDER BY id DESC').all() as Campaign[];
  }

  public getCampaign(id: number): Campaign | undefined {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | undefined;
  }

  public createCampaign(userId: number, name: string, intervalSeconds: number, messages: Array<{ phone: string; message: string }>): Campaign {
    const createTx = this.db.transaction(() => {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const campStmt = this.db.prepare(`
        INSERT INTO campaigns (user_id, name, status, interval_seconds, total_messages, pending_messages)
        VALUES (?, ?, 'RUNNING', ?, ?, ?)
      `);
      const campRes = campStmt.run(userId, name, intervalSeconds, messages.length, messages.length);
      const campaignId = Number(campRes.lastInsertRowid);

      const msgStmt = this.db.prepare(`
        INSERT INTO messages (campaign_id, user_id, phone, message, status, scheduled_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?)
      `);

      for (let i = 0; i < messages.length; i++) {
        const scheduledAt = nowEpoch + i * intervalSeconds;
        msgStmt.run(campaignId, userId, messages[i].phone, messages[i].message, scheduledAt);
      }

      return this.getCampaign(campaignId)!;
    });

    return createTx();
  }

  public updateCampaignStatus(id: number, status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED') {
    this.db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(status, id);
    this.syncCampaignCounts(id);
  }

  public syncCampaignCounts(campaignId: number) {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return;

    const counts = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
      FROM messages WHERE campaign_id = ?
    `).get(campaignId) as { total: number; sent: number; failed: number; pending: number };

    const total = counts.total || 0;
    const sent = counts.sent || 0;
    const failed = counts.failed || 0;
    const pending = counts.pending || 0;

    if (campaign.status === 'RUNNING' && pending === 0) {
      this.db.prepare(`
        UPDATE campaigns SET total_messages = ?, sent_messages = ?, failed_messages = ?, pending_messages = ?, status = 'COMPLETED' WHERE id = ?
      `).run(total, sent, failed, pending, campaignId);
    } else {
      this.db.prepare(`
        UPDATE campaigns SET total_messages = ?, sent_messages = ?, failed_messages = ?, pending_messages = ? WHERE id = ?
      `).run(total, sent, failed, pending, campaignId);
    }
  }

  public getOrCreateDirectCampaign(userId: number): Campaign {
    let camp = this.db.prepare("SELECT * FROM campaigns WHERE user_id = ? AND name = 'Direct Single Messages'").get(userId) as Campaign | undefined;
    if (!camp) {
      const res = this.db.prepare("INSERT INTO campaigns (user_id, name, status, interval_seconds, total_messages, sent_messages, failed_messages, pending_messages) VALUES (?, 'Direct Single Messages', 'COMPLETED', 0, 0, 0, 0, 0)").run(userId);
      camp = this.getCampaign(Number(res.lastInsertRowid))!;
    }
    return camp;
  }

  public createDirectMessageRecord(campaignId: number, userId: number, phone: string, message: string, status: 'SENT' | 'FAILED', errorMessage: string | null = null): QueueMessage {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO messages (campaign_id, user_id, phone, message, status, error_message, scheduled_at, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(campaignId, userId, phone, message, status, errorMessage, nowEpoch, status === 'SENT' ? nowIso : null);
    this.syncCampaignCounts(campaignId);
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(res.lastInsertRowid) as QueueMessage;
  }

  // Messages
  public getMessages(campaignId: number): QueueMessage[] {
    return this.db.prepare('SELECT * FROM messages WHERE campaign_id = ? ORDER BY id ASC').all(campaignId) as QueueMessage[];
  }

  public getAllMessages(userId?: number): QueueMessage[] {
    if (userId) {
      return this.db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 500').all(userId) as QueueMessage[];
    }
    return this.db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all() as QueueMessage[];
  }

  public getNextPendingMessage(): QueueMessage | undefined {
    const nowEpoch = Math.floor(Date.now() / 1000);
    return this.db.prepare(`
      SELECT m.*
      FROM messages m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN users u ON u.id = m.user_id
      JOIN whatsapp_instances wi ON wi.instance_name = u.instance_name
      WHERE m.status = 'PENDING'
        AND m.scheduled_at <= ?
        AND c.status = 'RUNNING'
        AND wi.status = 'open'
      ORDER BY m.scheduled_at ASC, m.id ASC
      LIMIT 1
    `).get(nowEpoch) as QueueMessage | undefined;
  }

  public markMessageSent(messageId: number, campaignId: number) {
    this.db.prepare(`
      UPDATE messages
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, error_message = NULL
      WHERE id = ?
    `).run(messageId);
    this.syncCampaignCounts(campaignId);
  }

  public markMessageFailed(messageId: number, campaignId: number, error: string) {
    this.db.prepare(`
      UPDATE messages
      SET status = 'FAILED', error_message = ?
      WHERE id = ?
    `).run(error, messageId);
    this.syncCampaignCounts(campaignId);
  }
}

export const dbManager = new DatabaseManager();
