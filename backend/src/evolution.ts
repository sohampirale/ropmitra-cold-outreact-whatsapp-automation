import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { dbManager } from './db.js';

dotenv.config();

const IS_MOCK = process.env.MOCK_EVOLUTION_API === 'true';
const SESSION_DIR = path.resolve(process.cwd(), 'whatsapp_session');

// Authentic-looking SVG QR code matrix for realistic dev/mock preview
const MOCK_QR_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" width="280" height="280" shape-rendering="crispEdges"><rect width="33" height="33" fill="white"/><path fill="black" d="M3 3h7v7H3zM4 4v5h5V4zM5 5h3v3H5zM23 3h7v7h-7zM24 4v5h5V4zM25 5h3v3h-2zM3 23h7v7H3zM4 24v5h5v-5zM5 25h3v3H5zM12 3h2v1h-2zM15 3h1v2h-1zM18 3h1v1h-1zM20 3h1v3h-1zM12 5h1v3h-1zM14 5h2v1h-2zM17 5h1v1h-1zM19 5h1v1h-1zM14 7h1v2h-1zM16 7h2v1h-2zM19 7h2v2h-2zM11 9h11v1H11zM3 11h1v1H3zM6 11h2v1H6zM9 11h1v2H9zM12 11h2v2h-2zM15 11h1v1h-1zM17 11h3v1h-3zM21 11h1v2h-1zM24 11h2v1h-2zM28 11h2v1h-2zM4 13h1v2H4zM7 13h1v1H7zM11 13h1v1h-1zM14 13h1v2h-1zM16 13h2v2h-2zM19 13h1v1h-1zM22 13h1v2h-1zM25 13h2v1h-2zM29 13h1v2h-1zM3 15h2v1H3zM6 15h1v2H6zM8 15h2v1H8zM11 15h2v1h-2zM18 15h1v2h-1zM20 15h2v1h-2zM24 15h1v1h-1zM27 15h1v2h-1zM4 17h1v1H4zM9 17h1v2H9zM12 17h3v1h-3zM16 17h1v1h-1zM19 17h1v2h-1zM21 17h2v1h-2zM25 17h1v1h-1zM29 17h1v1h-1zM3 19h1v2H3zM6 19h2v1H6zM11 19h1v1h-1zM13 19h2v2h-2zM17 19h1v1h-1zM22 19h2v1h-2zM26 19h2v2h-2zM5 21h1v1H5zM8 21h2v1H8zM12 21h1v2h-1zM15 21h2v1h-2zM18 21h2v1h-2zM21 21h1v1h-1zM24 21h1v2h-1zM28 21h2v1h-2zM11 23h2v1h-2zM14 23h1v2h-1zM16 23h3v1h-3zM20 23h1v1h-1zM22 23h2v2h-2zM25 23h1v1h-1zM27 23h3v1h-3zM12 25h1v1h-1zM15 25h1v2h-1zM17 25h1v1h-1zM19 25h2v1h-2zM23 25h1v2h-1zM26 25h2v1h-2zM29 25h1v1h-1zM11 27h2v2h-2zM14 27h1v1h-1zM16 27h2v1h-2zM19 27h1v2h-1zM21 27h1v1h-1zM24 27h2v2h-2zM27 27h1v1h-1zM13 29h1v1h-1zM15 29h2v1h-2zM18 29h1v1h-1zM22 29h1v1h-1zM27 29h3v1h-3z"/></svg>`;

interface ActiveSocket {
  sock: any;
  qrCode: string | null;
  phoneConnected?: string;
  status: 'open' | 'connecting' | 'disconnected';
}

export class EvolutionService {
  private activeSockets: Map<string, ActiveSocket> = new Map();

  private async initBaileysSocket(instanceName: string): Promise<ActiveSocket> {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    const instanceSessionDir = path.join(SESSION_DIR, instanceName);
    if (!fs.existsSync(instanceSessionDir)) {
      fs.mkdirSync(instanceSessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(instanceSessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ['Ropmitra WhatsApp AI', 'Chrome', '1.0.0'],
    });

    const activeSocket: ActiveSocket = {
      sock,
      qrCode: null,
      status: 'connecting',
    };
    this.activeSockets.set(instanceName, activeSocket);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          activeSocket.qrCode = qrDataUrl;
          activeSocket.status = 'connecting';
          dbManager.updateInstanceStatus(instanceName, 'connecting', qrDataUrl);
          console.log(`[Baileys Embedded] Generated fresh WhatsApp QR code for '${instanceName}'`);
        } catch (err) {
          console.error('[Baileys Embedded] Error generating QR code image:', err);
        }
      }

      if (connection === 'open') {
        const userJid = sock.user?.id || '';
        const cleanPhone = '+' + userJid.split(':')[0].split('@')[0];
        activeSocket.status = 'open';
        activeSocket.qrCode = null;
        activeSocket.phoneConnected = cleanPhone;
        dbManager.updateInstanceStatus(instanceName, 'open', null, cleanPhone);
        console.log(`[Baileys Embedded] Successfully connected to WhatsApp! Phone: ${cleanPhone}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Baileys Embedded] Connection closed. Should reconnect: ${shouldReconnect} (Status code: ${statusCode})`);
        
        activeSocket.status = 'disconnected';
        dbManager.updateInstanceStatus(instanceName, 'disconnected', null);

        if (shouldReconnect) {
          setTimeout(() => {
            this.initBaileysSocket(instanceName).catch(console.error);
          }, 3000);
        }
      }
    });

    return activeSocket;
  }

  public async connectInstance(instanceName: string): Promise<{
    status: 'open' | 'connecting' | 'disconnected';
    qrCode: string | null;
    phoneConnected?: string;
  }> {
    if (IS_MOCK) {
      const existing = dbManager.getInstance(instanceName);
      if (existing && existing.status === 'open') {
        return { status: 'open', qrCode: null, phoneConnected: existing.phone_connected || '+919876543210' };
      }
      dbManager.updateInstanceStatus(instanceName, 'connecting', MOCK_QR_DATA_URL);
      return {
        status: 'connecting',
        qrCode: MOCK_QR_DATA_URL,
      };
    }

    let active = this.activeSockets.get(instanceName);
    if (!active || active.status === 'disconnected') {
      active = await this.initBaileysSocket(instanceName);
    }

    // Give QR generation up to 2.5s if still connecting and QR not yet emitted
    if (active.status === 'connecting' && !active.qrCode) {
      await new Promise(r => setTimeout(r, 2000));
    }

    return {
      status: active.status,
      qrCode: active.qrCode,
      phoneConnected: active.phoneConnected,
    };
  }

  public async getConnectionState(instanceName: string): Promise<{
    status: 'open' | 'connecting' | 'disconnected';
    phoneConnected?: string;
  }> {
    if (IS_MOCK) {
      const existing = dbManager.getInstance(instanceName);
      return {
        status: (existing?.status as any) || 'disconnected',
        phoneConnected: existing?.phone_connected || undefined,
      };
    }

    const active = this.activeSockets.get(instanceName);
    if (active) {
      return {
        status: active.status,
        phoneConnected: active.phoneConnected,
      };
    }

    const existing = dbManager.getInstance(instanceName);
    return {
      status: (existing?.status as any) || 'disconnected',
      phoneConnected: existing?.phone_connected || undefined,
    };
  }

  public async simulateMockConnect(instanceName: string, phone = '+919876543210'): Promise<boolean> {
    dbManager.updateInstanceStatus(instanceName, 'open', null, phone);
    return true;
  }

  public async logoutInstance(instanceName: string): Promise<boolean> {
    if (IS_MOCK) {
      dbManager.updateInstanceStatus(instanceName, 'disconnected', null);
      return true;
    }

    const active = this.activeSockets.get(instanceName);
    if (active && active.sock) {
      try {
        await active.sock.logout();
      } catch (err) {
        // ignore logout errors
      }
      this.activeSockets.delete(instanceName);
    }

    // Clean session directory on logout so next connect generates a clean QR
    const instanceSessionDir = path.join(SESSION_DIR, instanceName);
    if (fs.existsSync(instanceSessionDir)) {
      fs.rmSync(instanceSessionDir, { recursive: true, force: true });
    }

    dbManager.updateInstanceStatus(instanceName, 'disconnected', null);
    return true;
  }

  public async sendTextMessage(
    instanceName: string,
    phone: string,
    message: string
  ): Promise<{ id: string; success: boolean }> {
    const cleanPhone = phone.trim();

    if (IS_MOCK) {
      console.log(`[DEV/MOCK MODE] Simulating WhatsApp delivery to ${cleanPhone}: "${message.substring(0, 40)}..."`);
      return {
        id: `MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        success: true,
      };
    }

    const active = this.activeSockets.get(instanceName);
    if (!active || active.status !== 'open' || !active.sock) {
      throw new Error(`WhatsApp instance '${instanceName}' is not connected. Please scan the QR code first.`);
    }

    // Format phone to E.164 without '+' and append '@s.whatsapp.net'
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const jid = `${digitsOnly}@s.whatsapp.net`;

    try {
      const res = await active.sock.sendMessage(jid, { text: message });
      console.log(`[Baileys Embedded] Successfully delivered WhatsApp message to ${digitsOnly}! Message ID: ${res?.key?.id}`);
      return {
        id: res?.key?.id || `WA_${Date.now()}`,
        success: true,
      };
    } catch (err: any) {
      console.error(`[Baileys Embedded] Failed to send message to ${digitsOnly}:`, err);
      throw new Error(`Failed to send WhatsApp message via embedded Baileys: ${err.message || err}`);
    }
  }
}

export const evolutionService = new EvolutionService();

