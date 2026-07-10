import { dbManager } from './db.js';
import { evolutionService } from './evolution.js';

export class QueueWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private pollIntervalMs: number;

  constructor() {
    this.pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS) || 3000;
  }

  public start() {
    if (this.timer) return;
    console.log(`[QueueWorker] Started SQLite background worker (Polling every ${this.pollIntervalMs}ms)...`);
    this.timer = setInterval(() => this.tick(), this.pollIntervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const nextMessage = dbManager.getNextPendingMessage();
      if (!nextMessage) {
        this.isProcessing = false;
        return;
      }

      // Find user & whatsapp instance
      const users = dbManager.getUsers();
      const user = users.find((u) => u.id === nextMessage.user_id) || users[0];
      const instanceName = user?.instance_name || 'ropmitra_inst_1';

      console.log(`[QueueWorker] Processing message #${nextMessage.id} to ${nextMessage.phone} for campaign #${nextMessage.campaign_id}`);

      try {
        await evolutionService.sendTextMessage(instanceName, nextMessage.phone, nextMessage.message);
        dbManager.markMessageSent(nextMessage.id, nextMessage.campaign_id);
        console.log(`[QueueWorker] Successfully delivered message #${nextMessage.id} to ${nextMessage.phone}`);
      } catch (error: any) {
        const errorMsg = error?.message || 'Failed to send WhatsApp message';
        console.error(`[QueueWorker] Failed message #${nextMessage.id}: ${errorMsg}`);
        dbManager.markMessageFailed(nextMessage.id, nextMessage.campaign_id, errorMsg);
      }
    } catch (err: any) {
      console.error(`[QueueWorker] Uncaught worker error:`, err?.message || err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const queueWorker = new QueueWorker();
