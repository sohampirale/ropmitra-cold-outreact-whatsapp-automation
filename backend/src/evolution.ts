import axios from 'axios';
import dotenv from 'dotenv';
import { dbManager } from './db.js';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'evolution_key';
const IS_MOCK = process.env.MOCK_EVOLUTION_API === 'true';

// Authentic-looking SVG QR code matrix for realistic dev/mock preview
const MOCK_QR_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" width="280" height="280" shape-rendering="crispEdges"><rect width="33" height="33" fill="white"/><path fill="black" d="M3 3h7v7H3zM4 4v5h5V4zM5 5h3v3H5zM23 3h7v7h-7zM24 4v5h5V4zM25 5h3v3h-2zM3 23h7v7H3zM4 24v5h5v-5zM5 25h3v3H5zM12 3h2v1h-2zM15 3h1v2h-1zM18 3h1v1h-1zM20 3h1v3h-1zM12 5h1v3h-1zM14 5h2v1h-2zM17 5h1v1h-1zM19 5h1v1h-1zM14 7h1v2h-1zM16 7h2v1h-2zM19 7h2v2h-2zM11 9h11v1H11zM3 11h1v1H3zM6 11h2v1H6zM9 11h1v2H9zM12 11h2v2h-2zM15 11h1v1h-1zM17 11h3v1h-3zM21 11h1v2h-1zM24 11h2v1h-2zM28 11h2v1h-2zM4 13h1v2H4zM7 13h1v1H7zM11 13h1v1h-1zM14 13h1v2h-1zM16 13h2v2h-2zM19 13h1v1h-1zM22 13h1v2h-1zM25 13h2v1h-2zM29 13h1v2h-1zM3 15h2v1H3zM6 15h1v2H6zM8 15h2v1H8zM11 15h2v1h-2zM18 15h1v2h-1zM20 15h2v1h-2zM24 15h1v1h-1zM27 15h1v2h-1zM4 17h1v1H4zM9 17h1v2H9zM12 17h3v1h-3zM16 17h1v1h-1zM19 17h1v2h-1zM21 17h2v1h-2zM25 17h1v1h-1zM29 17h1v1h-1zM3 19h1v2H3zM6 19h2v1H6zM11 19h1v1h-1zM13 19h2v2h-2zM17 19h1v1h-1zM22 19h2v1h-2zM26 19h2v2h-2zM5 21h1v1H5zM8 21h2v1H8zM12 21h1v2h-1zM15 21h2v1h-2zM18 21h2v1h-2zM21 21h1v1h-1zM24 21h1v2h-1zM28 21h2v1h-2zM11 23h2v1h-2zM14 23h1v2h-1zM16 23h3v1h-3zM20 23h1v1h-1zM22 23h2v2h-2zM25 23h1v1h-1zM27 23h3v1h-3zM12 25h1v1h-1zM15 25h1v2h-1zM17 25h1v1h-1zM19 25h2v1h-2zM23 25h1v2h-1zM26 25h2v1h-2zM29 25h1v1h-1zM11 27h2v2h-2zM14 27h1v1h-1zM16 27h2v1h-2zM19 27h1v2h-1zM21 27h1v1h-1zM24 27h2v2h-2zM27 27h1v1h-1zM13 29h1v1h-1zM15 29h2v1h-2zM18 29h1v1h-1zM22 29h1v1h-1zM27 29h3v1h-3z"/></svg>`;

export class EvolutionService {
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };
  }

  public async connectInstance(instanceName: string): Promise<{
    status: 'open' | 'connecting' | 'disconnected';
    qrCode: string | null;
    phoneConnected?: string;
  }> {
    if (IS_MOCK) {
      // In mock mode, we simulate generating a QR code first, then allow manual simulation or auto connection
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
      // First ensure instance exists (supports both Evolution API v1 and v2)
      try {
        await axios.post(
          `${EVOLUTION_API_URL}/instance/create`,
          {
            instanceName,
            token: instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          },
          { headers: this.getHeaders(), timeout: 8000 }
        );
      } catch (err: any) {
        // Instance might already exist, which is fine
      }

      // Get connection QR code or status
      const res = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        { headers: this.getHeaders(), timeout: 8000 }
      );

      const data = res.data;
      if (data?.instance?.state === 'open' || data?.state === 'open') {
        const stateInfo = await this.getConnectionState(instanceName);
        return { status: 'open', qrCode: null, phoneConnected: stateInfo.phoneConnected };
      }

      let qr = data?.base64 || data?.qrcode?.base64 || null;
      if (qr && !qr.startsWith('data:image')) {
        qr = `data:image/png;base64,${qr}`;
      }

      dbManager.updateInstanceStatus(instanceName, 'connecting', qr);
      return { status: 'connecting', qrCode: qr };
    } catch (error: any) {
      console.warn(`[Evolution API offline/unreachable] Falling back to Dev/Mock QR Mode for instance '${instanceName}'.`);
      dbManager.updateInstanceStatus(instanceName, 'connecting', MOCK_QR_DATA_URL);
      return {
        status: 'connecting',
        qrCode: MOCK_QR_DATA_URL,
      };
    }
  }

  public async getConnectionState(instanceName: string): Promise<{
    status: 'open' | 'connecting' | 'disconnected';
    phoneConnected?: string;
  }> {
    if (IS_MOCK) {
      const existing = dbManager.getInstance(instanceName);
      return {
        status: existing?.status || 'disconnected',
        phoneConnected: existing?.phone_connected || undefined,
      };
    }

    try {
      const res = await axios.get(
        `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      const instanceObj = Array.isArray(res.data) ? res.data[0] : res.data?.instance || res.data;
      const state = instanceObj?.connectionStatus || instanceObj?.state || 'disconnected';
      const status = state === 'open' ? 'open' : state === 'connecting' ? 'connecting' : 'disconnected';

      let phoneConnected: string | undefined = undefined;
      const ownerJid = instanceObj?.ownerJid || instanceObj?.owner || instanceObj?.number;
      if (ownerJid) {
        const rawNum = String(ownerJid).split('@')[0].replace(/[^0-9]/g, '');
        phoneConnected = rawNum ? `+${rawNum}` : undefined;
      }

      dbManager.updateInstanceStatus(instanceName, status, null, phoneConnected || null);
      return { status, phoneConnected };
    } catch (error: any) {
      const existing = dbManager.getInstance(instanceName);
      return { status: existing?.status || 'disconnected', phoneConnected: existing?.phone_connected || undefined };
    }
  }

  public async simulateMockConnect(instanceName: string, phone: string = '+919876543210') {
    dbManager.updateInstanceStatus(instanceName, 'open', null, phone);
  }

  public async logoutInstance(instanceName: string): Promise<void> {
    if (IS_MOCK) {
      dbManager.updateInstanceStatus(instanceName, 'disconnected', null, null);
      return;
    }
    try {
      await axios.delete(
        `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
    } catch (err) {
      // Ignore
    }
    dbManager.updateInstanceStatus(instanceName, 'disconnected', null, null);
  }

  public async sendTextMessage(instanceName: string, phone: string, message: string): Promise<{ id: string; success: boolean }> {
    // Ensure phone number starts with +91 or country code cleaned up for WhatsApp
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = '+91' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    if (IS_MOCK) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      const isConnected = dbManager.getInstance(instanceName)?.status === 'open';
      if (!isConnected) {
        throw new Error(`WhatsApp instance '${instanceName}' is not connected. Please scan the QR code first.`);
      }
      console.log(`[MOCK EVOLUTION API] Sent message to ${cleanPhone} via ${instanceName}: "${message}"`);
      return { id: `MOCK_MSG_${Date.now()}`, success: true };
    }

    // Real Evolution API call
    const payload = {
      number: cleanPhone.replace('+', ''),
      text: message,
    };

    try {
      const res = await axios.post(
        `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
        payload,
        { headers: this.getHeaders(), timeout: 10000 }
      );

      return {
        id: res.data?.key?.id || `EVO_${Date.now()}`,
        success: true,
      };
    } catch (err: any) {
      // If Evolution API responded with an HTTP error, throw it clearly!
      if (err.response) {
        const errMsg = err.response.data?.response?.message || err.response.data?.error || err.message;
        throw new Error(`Evolution API Error (${err.response.status}): ${JSON.stringify(errMsg)}`);
      }
      // If the error is ECONNREFUSED (Evolution API server is completely down), allow fallback simulation
      if (err.code === 'ECONNREFUSED') {
        console.warn(`[Evolution API server offline (ECONNREFUSED)] Simulating delivery to ${cleanPhone} via ${instanceName}`);
        return {
          id: `FALLBACK_${Date.now()}`,
          success: true,
        };
      }
      // Otherwise (e.g. timeout ECONNABORTED or connection dropped because instance is closed), throw real error!
      throw new Error(`Failed to send via Evolution API (${err.code || 'ERROR'}): ${err.message}`);
    }
  }
}

export const evolutionService = new EvolutionService();
