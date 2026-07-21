import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { dbManager } from '../db.js';
import { evolutionService } from '../evolution.js';

export const apiRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Disable browser caching on API endpoints so QR codes & status poll fresh
apiRouter.use((_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ============================================================================
// 1. USERS & INSTANCES (MULTI-USER SUPPORT)
// ============================================================================

apiRouter.get('/users', (_req: Request, res: Response) => {
  const users = dbManager.getUsers();
  const enhancedUsers = users.map((u) => {
    const inst = dbManager.getInstance(u.instance_name);
    return {
      ...u,
      instanceStatus: inst?.status || 'disconnected',
      phoneConnected: inst?.phone_connected || null,
      qrCode: inst?.qr_code || null,
    };
  });
  res.json({ users: enhancedUsers, isMockMode: process.env.MOCK_EVOLUTION_API === 'true' });
});

apiRouter.post('/users', (req: Request, res: Response): void => {
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Name and Email are required' });
    return;
  }
  const cleanInstanceName = `ropmitra_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
  try {
    const user = dbManager.createUser(name, email, cleanInstanceName);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

apiRouter.get('/instances/:instanceName/connect', async (req: Request, res: Response): Promise<void> => {
  const { instanceName } = req.params;
  try {
    const result = await evolutionService.connectInstance(instanceName);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate QR Code' });
  }
});

apiRouter.get('/instances/:instanceName/status', async (req: Request, res: Response): Promise<void> => {
  const { instanceName } = req.params;
  try {
    const result = await evolutionService.getConnectionState(instanceName);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check instance status' });
  }
});

apiRouter.post('/instances/:instanceName/simulate-connect', async (req: Request, res: Response): Promise<void> => {
  const { instanceName } = req.params;
  const { phone } = req.body;
  try {
    await evolutionService.simulateMockConnect(instanceName, phone || '+919876543210');
    res.json({ success: true, status: 'open', phoneConnected: phone || '+919876543210' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to simulate connect' });
  }
});

apiRouter.post('/instances/:instanceName/logout', async (req: Request, res: Response): Promise<void> => {
  const { instanceName } = req.params;
  try {
    await evolutionService.logoutInstance(instanceName);
    res.json({ success: true, status: 'disconnected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to logout instance' });
  }
});

// ============================================================================
// 2. CAMPAIGNS & CSV UPLOAD
// ============================================================================

apiRouter.post('/campaigns/preview-csv', upload.single('csv'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No CSV file uploaded' });
    return;
  }

  try {
    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const parsedRows: Array<{ phone: string; message: string; isValid: boolean; reason?: string }> = [];

    if (records.length > 0) {
      const headers = Object.keys(records[0] || {});

      // Find phone column matching standard keywords
      let phoneCol = headers.find((k) => /phone|mobile|whatsapp|contact|^number$/i.test(k.trim())) || headers[0];

      // Find message column matching standard keywords, ensuring distinctness from phoneCol
      let msgCol =
        headers.find((k) => k !== phoneCol && /message|msg|text|body|content|template/i.test(k.trim())) ||
        headers.find((k) => k !== phoneCol);

      for (const row of records) {
        let rawPhone = String(row[phoneCol] || '').trim();
        const message = msgCol ? String(row[msgCol] || '').trim() : '';

        // Normalize +91 formatting
        let phone = rawPhone.replace(/[^0-9+]/g, '');
        if (phone && !phone.startsWith('+')) {
          if (phone.length === 10) {
            phone = '+91' + phone;
          } else {
            phone = '+' + phone;
          }
        }

        const isValid = Boolean(phone && phone.length >= 10 && message.length > 0);
        let reason = undefined;
        if (!phone) reason = 'Missing phone number';
        else if (!message) reason = 'Missing message text';

        parsedRows.push({ phone, message, isValid, reason });
      }
    }

    res.json({ success: true, totalRows: parsedRows.length, rows: parsedRows });
  } catch (error: any) {
    res.status(400).json({ error: `Invalid CSV format: ${error.message}` });
  }
});

apiRouter.post('/campaigns', (req: Request, res: Response): void => {
  const { userId, name, intervalSeconds = 300, messages } = req.body;

  if (!userId || !name || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'User ID, Campaign Name, and at least one message are required.' });
    return;
  }

  try {
    const validMessages = messages.filter((m: any) => m.phone && m.message);
    const campaign = dbManager.createCampaign(
      Number(userId),
      name,
      Number(intervalSeconds) || 300,
      validMessages
    );
    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create campaign' });
  }
});

apiRouter.get('/campaigns', (req: Request, res: Response) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const campaigns = dbManager.getCampaigns(userId);
  res.json({ success: true, campaigns });
});

apiRouter.get('/campaigns/:id', (req: Request, res: Response): void => {
  const campaignId = Number(req.params.id);
  const campaign = dbManager.getCampaign(campaignId);
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  const messages = dbManager.getMessages(campaignId);
  res.json({ success: true, campaign, messages });
});

apiRouter.post('/campaigns/:id/status', (req: Request, res: Response): void => {
  const campaignId = Number(req.params.id);
  const { status } = req.body; // 'RUNNING' | 'PAUSED' | 'CANCELLED'
  if (!['RUNNING', 'PAUSED', 'CANCELLED'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  dbManager.updateCampaignStatus(campaignId, status);
  res.json({ success: true, status });
});

// ============================================================================
// 3. SINGLE MESSAGE (1-TO-1 DIRECT MESSAGING)
// ============================================================================

apiRouter.post('/messages/send-single', async (req: Request, res: Response): Promise<void> => {
  const { userId, instanceName, phone: rawPhone, message, sendNow = true } = req.body;

  if (!rawPhone || !message) {
    res.status(400).json({ error: 'Phone number and message text are required.' });
    return;
  }

  // Normalize phone formatting (+91 for 10-digit Indian numbers)
  let phone = String(rawPhone).trim().replace(/[^0-9+]/g, '');
  if (phone && !phone.startsWith('+')) {
    if (phone.length === 10) {
      phone = '+91' + phone;
    } else {
      phone = '+' + phone;
    }
  }

  if (!phone || phone.length < 10) {
    res.status(400).json({ error: 'Invalid phone number format. Please provide a valid 10-digit number or +E.164 number.' });
    return;
  }

  let targetUser = userId ? dbManager.getUserById(Number(userId)) : dbManager.getUsers()[0];
  let instName = instanceName || targetUser?.instance_name || 'ropmitra_inst_1';
  let uid = targetUser?.id || 1;

  if (sendNow) {
    try {
      const sendResult = await evolutionService.sendTextMessage(instName, phone, message);
      const directCampaign = dbManager.getOrCreateDirectCampaign(uid);
      const msgRecord = dbManager.createDirectMessageRecord(directCampaign.id, uid, phone, message, 'SENT', null);
      res.json({
        success: true,
        status: 'SENT',
        messageId: sendResult.id || msgRecord.id,
        sentTo: phone,
        sentAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const errMsg = err.message || 'Error sending single message';
      const directCampaign = dbManager.getOrCreateDirectCampaign(uid);
      dbManager.createDirectMessageRecord(directCampaign.id, uid, phone, message, 'FAILED', errMsg);
      res.status(400).json({ error: errMsg, status: 'FAILED' });
    }
  } else {
    try {
      const campaignName = `Direct Msg to ${phone}`;
      const campaign = dbManager.createCampaign(uid, campaignName, 5, [{ phone, message }]);
      res.json({
        success: true,
        status: 'QUEUED',
        campaignId: campaign.id,
        scheduledFor: phone,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error queuing single message' });
    }
  }
});

// ============================================================================
// 3. HISTORY AUDIT TRAIL & CSV EXPORTS
// ============================================================================

apiRouter.get('/campaigns/:id/export', (req: Request, res: Response): void => {
  const campaignId = Number(req.params.id);
  const campaign = dbManager.getCampaign(campaignId);
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }

  const messages = dbManager.getMessages(campaignId);
  const csvData = messages.map((m) => ({
    Phone: m.phone,
    Message: m.message,
    Status: m.status,
    Scheduled_At: new Date(m.scheduled_at * 1000).toISOString(),
    Sent_At: m.sent_at || 'N/A',
    Error_Reason: m.error_message || '',
  }));

  const output = stringify(csvData, { header: true });
  const filename = `campaign_${campaign.name.replace(/[^a-z0-9]/gi, '_')}_history.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(output);
});

apiRouter.get('/history/all', (req: Request, res: Response) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const messages = dbManager.getAllMessages(userId);
  res.json({ success: true, messages });
});

apiRouter.get('/history/export-all', (req: Request, res: Response) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const messages = dbManager.getAllMessages(userId);
  const csvData = messages.map((m) => ({
    Message_ID: m.id,
    Campaign_ID: m.campaign_id,
    Phone: m.phone,
    Message: m.message,
    Status: m.status,
    Scheduled_At: new Date(m.scheduled_at * 1000).toISOString(),
    Sent_At: m.sent_at || 'N/A',
    Error_Reason: m.error_message || '',
  }));

  const output = stringify(csvData, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="all_whatsapp_messages_history.csv"');
  res.send(output);
});
