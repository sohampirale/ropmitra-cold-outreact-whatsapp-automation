import axios from 'axios';
import dotenv from 'dotenv';
import { dbManager } from './db.js';

dotenv.config();

const IS_MOCK = process.env.MOCK_EVOLUTION_API === 'true';
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Authentic-looking SVG QR code matrix for realistic dev/mock preview
const MOCK_QR_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" width="280" height="280" shape-rendering="crispEdges"><rect width="33" height="33" fill="white"/><path fill="black" d="M3 3h7v7H3zM4 4v5h5V4zM5 5h3v3H5zM23 3h7v7h-7zM24 4v5h5V4zM25 5h3v3h-2zM3 23h7v7H3zM4 24v5h5v-5zM5 25h3v3H5zM12 3h2v1h-2zM15 3h1v2h-1zM18 3h1v1h-1zM20 3h1v3h-1zM12 5h1v3h-1zM14 5h2v1h-2zM17 5h1v1h-1zM19 5h1v1h-1zM14 7h1v2h-1zM16 7h2v1h-2zM19 7h2v2h-2zM11 9h11v1H11zM3 11h1v1H3zM6 11h2v1H6zM9 11h1v2H9zM12 11h2v2h-2zM15 11h1v1h-1zM17 11h3v1h-3zM21 11h1v2h-1zM24 11h2v1h-2zM28 11h2v1h-2zM4 13h1v2H4zM7 13h1v1H7zM11 13h1v1h-1zM14 13h1v2h-1zM16 13h2v2h-2zM19 13h1v1h-1zM22 13h1v2h-1zM25 13h2v1h-2zM29 13h1v2h-1zM3 15h2v1H3zM6 15h1v2H6zM8 15h2v1H8zM11 15h2v1h-2zM18 15h1v2h-1zM20 15h2v1h-2zM24 15h1v1h-1zM27 15h1v2h-1zM4 17h1v1H4zM9 17h1v2H9zM12 17h3v1h-3zM16 17h1v1h-1zM19 17h1v2h-1zM21 17h2v1h-2zM25 17h1v1h-1zM29 17h1v1h-1zM3 19h1v2H3zM6 19h2v1H6zM11 19h1v1h-1zM13 19h2v2h-2zM17 19h1v1h-1zM22 19h2v1h-2zM26 19h2v2h-2zM5 21h1v1H5zM8 21h2v1H8zM12 21h1v2h-1zM15 21h2v1h-2zM18 21h2v1h-2zM21 21h1v1h-1zM24 21h1v2h-1zM28 21h2v1h-2zM11 23h2v1h-2zM14 23h1v2h-1zM16 23h3v1h-3zM20 23h1v1h-1zM22 23h2v2h-2zM25 23h1v1h-1zM27 23h3v1h-3zM12 25h1v1h-1zM15 25h1v2h-1zM17 25h1v1h-1zM19 25h2v1h-2zM23 25h1v2h-1zM26 25h2v1h-2zM29 25h1v1h-1zM11 27h2v2h-2zM14 27h1v1h-1zM16 27h2v1h-2zM19 27h1v2h-1zM21 27h1v1h-1zM24 27h2v2h-2zM27 27h1v1h-1zM13 29h1v1h-1zM15 29h2v1h-2zM18 29h1v1h-1zM22 29h1v1h-1zM27 29h3v1h-3z"/></svg>`;

export class EvolutionService {
  private getHeaders() {
    return {
      apikey: EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Ensures instance is created on the Evolution API container if it doesn't already exist.
   */
  public async ensureInstanceCreated(instanceName: string): Promise<boolean> {
    if (IS_MOCK) return true;

    try {
      await axios.post(
        `${EVOLUTION_API_URL}/instance/create`,
        {
          instanceName,
          token: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        },
        { headers: this.getHeaders(), timeout: 10000 }
      );
      console.log(`[Evolution REST] Created new instance '${instanceName}' on remote Evolution API container.`);
      return true;
    } catch (err: any) {
      // If instance already exists, Evolution API returns 403 or error message
      if (err.response?.status === 403 || err.response?.data?.message?.includes('already in use')) {
        console.log(`[Evolution REST] Instance '${instanceName}' already exists on remote Evolution API.`);
        return true;
      }
      console.warn(`[Evolution REST] Notice on instance creation for '${instanceName}': ${err.response?.data?.message || err.message}`);
      return false;
    }
  }

  /**
   * Connect to instance and retrieve fresh WhatsApp QR code or connection status.
   */
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

    try {
      // Ensure instance exists
      await this.ensureInstanceCreated(instanceName);

      // Call connect endpoint to get QR code base64 or status
      const res = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        headers: this.getHeaders(),
        timeout: 15000,
      });

      const data = res.data;
      const state = (data.instance?.state || data.state || data.status || 'connecting').toLowerCase();

      if (state === 'open' || state === 'connected') {
        const owner = data.instance?.owner || data.owner || '';
        const cleanPhone = owner ? '+' + owner.split(':')[0].split('@')[0].replace(/\D/g, '') : undefined;
        dbManager.updateInstanceStatus(instanceName, 'open', null, cleanPhone);
        return { status: 'open', qrCode: null, phoneConnected: cleanPhone };
      }

      // Extract Base64 QR code image string from various Evolution API response formats
      let rawQr = data.base64 || data.code || data.qrcode?.base64 || data.qrcode?.code || data.pairingCode || null;
      if (rawQr && typeof rawQr === 'string' && !rawQr.startsWith('data:')) {
        rawQr = `data:image/png;base64,${rawQr}`;
      }

      dbManager.updateInstanceStatus(instanceName, 'connecting', rawQr);
      return {
        status: 'connecting',
        qrCode: rawQr,
      };
    } catch (err: any) {
      console.error(`[Evolution REST] Error connecting instance '${instanceName}':`, err.response?.data || err.message);
      
      // Fallback: query state if connect endpoint errored
      return this.getConnectionState(instanceName).then((s) => ({
        status: s.status,
        qrCode: null,
        phoneConnected: s.phoneConnected,
      }));
    }
  }

  /**
   * Fetch current connection state of an instance from Evolution API.
   */
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

    try {
      const res = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      const data = res.data;
      const stateRaw = (data.instance?.state || data.state || data.status || 'disconnected').toLowerCase();

      let status: 'open' | 'connecting' | 'disconnected' = 'disconnected';
      if (stateRaw === 'open' || stateRaw === 'connected') {
        status = 'open';
      } else if (stateRaw === 'connecting') {
        status = 'connecting';
      }

      let phoneConnected: string | undefined = undefined;
      const owner = data.instance?.owner || data.owner || data.instance?.ownerJid;
      if (owner) {
        const cleanNumber = String(owner).split(':')[0].split('@')[0].replace(/\D/g, '');
        if (cleanNumber) {
          phoneConnected = `+${cleanNumber}`;
        }
      }

      dbManager.updateInstanceStatus(instanceName, status, null, phoneConnected);
      return { status, phoneConnected };
    } catch (err: any) {
      console.warn(`[Evolution REST] Could not fetch state for '${instanceName}': ${err.response?.data?.message || err.message}`);
      const existing = dbManager.getInstance(instanceName);
      return {
        status: (existing?.status as any) || 'disconnected',
        phoneConnected: existing?.phone_connected || undefined,
      };
    }
  }

  /**
   * Simulate mock connect (used only when MOCK_EVOLUTION_API=true).
   */
  public async simulateMockConnect(instanceName: string, phone = '+919876543210'): Promise<boolean> {
    dbManager.updateInstanceStatus(instanceName, 'open', null, phone);
    return true;
  }

  /**
   * Logout / Delete instance session from Evolution API server.
   */
  public async logoutInstance(instanceName: string): Promise<boolean> {
    if (IS_MOCK) {
      dbManager.updateInstanceStatus(instanceName, 'disconnected', null);
      return true;
    }

    try {
      await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });
      console.log(`[Evolution REST] Logged out instance '${instanceName}' on remote Evolution API.`);
    } catch (err: any) {
      console.warn(`[Evolution REST] Logout warning for '${instanceName}': ${err.response?.data?.message || err.message}`);
    }

    try {
      await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });
      console.log(`[Evolution REST] Deleted instance '${instanceName}' on remote Evolution API.`);
    } catch (err: any) {
      // ignore deletion errors if instance was already deleted
    }

    dbManager.updateInstanceStatus(instanceName, 'disconnected', null);
    return true;
  }

  /**
   * Send WhatsApp text message via Evolution API REST endpoint POST /message/sendText/:instanceName
   */
  public async sendTextMessage(
    instanceName: string,
    phone: string,
    message: string
  ): Promise<{ id: string; success: boolean }> {
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    if (IS_MOCK) {
      console.log(`[DEV/MOCK MODE] Simulating Evolution API delivery to ${cleanPhone}: "${message.substring(0, 40)}..."`);
      return {
        id: `MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        success: true,
      };
    }

    try {
      const res = await axios.post(
        `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
        {
          number: digitsOnly,
          text: message,
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
        }
      );

      const msgId = res.data?.key?.id || res.data?.messageId || res.data?.id || `EVO_${Date.now()}`;
      console.log(`[Evolution REST] Successfully sent message via remote Evolution API to ${digitsOnly}. ID: ${msgId}`);
      return {
        id: String(msgId),
        success: true,
      };
    } catch (err: any) {
      if (err.response?.status === 404) {
        dbManager.updateInstanceStatus(instanceName, 'disconnected', null);
        console.error(`[Evolution REST] Instance '${instanceName}' does not exist on remote Evolution API server. Please scan QR code in the browser UI.`);
        throw new Error(`WhatsApp instance '${instanceName}' is not connected on Evolution API. Please scan QR code in the dashboard first.`);
      }
      const errorDetail = err.response?.data?.message || err.response?.data?.error || err.message || err;
      console.error(`[Evolution REST] Failed to send message via Evolution API to ${digitsOnly}:`, errorDetail);
      throw new Error(`Evolution API send error: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}`);
    }
  }
}

export const evolutionService = new EvolutionService();
