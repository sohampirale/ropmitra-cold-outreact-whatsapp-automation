import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { dbManager } from '../db.js';
import { evolutionService } from '../evolution.js';

export const apiRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
  await evolutionService.simulateMockConnect(instanceName, phone || '+919876543210');
  res.json({ success: true, status: 'open', phoneConnected: phone || '+919876543210' });
});

apiRouter.post('/instances/:instanceName/logout', async (req: Request, res: Response): Promise<void> => {
  const { instanceName } = req.params;
  await evolutionService.logoutInstance(instanceName);
  res.json({ success: true, status: 'disconnected' });
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
    });

    const parsedRows: Array<{ phone: string; message: string; isValid: boolean; reason?: string }> = [];

    for (const row of records as Record<string, string>[]) {
      // Find phone column (phone, phone_no, phone_number, mobile, number, etc.)
      const phoneCol = Object.keys(row).find((k) => /phone|mobile|number|no/i.test(k)) || Object.keys(row)[0];
      // Find message column (message, msg, text, content, etc.)
      const msgCol = Object.keys(row).find((k) => /message|msg|text|content/i.test(k)) || Object.keys(row)[1];

      let rawPhone = String(row[phoneCol] || '').trim();
      const message = String(row[msgCol] || '').trim();

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
