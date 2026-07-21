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
      const user = dbManager.getUserById(nextMessage.user_id);
      const instanceName = user?.instance_name || 'ropmitra_inst_1';

      // Defensive check: Verify instance exists and is open
      const instance = dbManager.getInstance(instanceName);
      if (!instance || instance.status !== 'open') {
        console.warn(`[QueueWorker] Skipping message #${nextMessage.id} for user #${nextMessage.user_id} - Instance '${instanceName}' status is '${instance?.status || 'disconnected'}'. Keeping message PENDING.`);
        this.isProcessing = false;
        return;
      }

      console.log(`[QueueWorker] Processing message #${nextMessage.id} to ${nextMessage.phone} for campaign #${nextMessage.campaign_id}`);

      try {
        await evolutionService.sendTextMessage(instanceName, nextMessage.phone, nextMessage.message);
        dbManager.markMessageSent(nextMessage.id, nextMessage.campaign_id);
        console.log(`[QueueWorker] Successfully delivered message #${nextMessage.id} to ${nextMessage.phone}`);
      } catch (error: any) {
        // Re-check instance status to see if send failed because instance became disconnected during execution
        const recheckedInst = dbManager.getInstance(instanceName);
        if (recheckedInst && recheckedInst.status !== 'open') {
          console.warn(`[QueueWorker] Send attempt failed for message #${nextMessage.id} due to instance '${instanceName}' disconnection. Message remains PENDING.`);
        } else {
          const errorMsg = error?.message || 'Failed to send WhatsApp message';
          console.error(`[QueueWorker] Failed message #${nextMessage.id}: ${errorMsg}`);
          dbManager.markMessageFailed(nextMessage.id, nextMessage.campaign_id, errorMsg);
        }
      }
    } catch (err: any) {
      console.error(`[QueueWorker] Uncaught worker error:`, err?.message || err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const queueWorker = new QueueWorker();
