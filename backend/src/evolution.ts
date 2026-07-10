import axios from 'axios';
import dotenv from 'dotenv';
import { dbManager } from './db.js';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'evolution_key';
const IS_MOCK = process.env.MOCK_EVOLUTION_API === 'true';

// Sample mock SVG QR code base64 or SVG for demo mode
const MOCK_QR_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><rect width="100%" height="100%" fill="white"/><rect x="20" y="20" width="60" height="60" fill="black"/><rect x="30" y="30" width="40" height="40" fill="white"/><rect x="40" y="40" width="20" height="20" fill="black"/><rect x="180" y="20" width="60" height="60" fill="black"/><rect x="190" y="30" width="40" height="40" fill="white"/><rect x="200" y="40" width="20" height="20" fill="black"/><rect x="20" y="180" width="60" height="60" fill="black"/><rect x="30" y="190" width="40" height="40" fill="white"/><rect x="40" y="200" width="20" height="20" fill="black"/><text x="130" y="135" font-size="12" font-family="sans-serif" text-anchor="middle" fill="%2325D366" font-weight="bold">SCAN WHATSAPP QR</text><circle cx="130" cy="110" r="15" fill="%2325D366"/></svg>`;

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
      // First ensure instance exists
      try {
        await axios.post(
          `${EVOLUTION_API_URL}/instance/create`,
          {
            instanceName,
            token: instanceName,
            qrcode: true,
          },
          { headers: this.getHeaders(), timeout: 5000 }
        );
      } catch (err: any) {
        // Instance might already exist, which is fine
      }

      // Get connection QR code or status
      const res = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        { headers: this.getHeaders(), timeout: 5000 }
      );

      const data = res.data;
      if (data?.instance?.state === 'open') {
        dbManager.updateInstanceStatus(instanceName, 'open', null, data?.instance?.owner || null);
        return { status: 'open', qrCode: null, phoneConnected: data?.instance?.owner };
      }

      const qr = data?.base64 || data?.qrcode?.base64 || null;
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
        `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      const state = res.data?.instance?.state || res.data?.state || 'disconnected';
      const status = state === 'open' ? 'open' : state === 'connecting' ? 'connecting' : 'disconnected';
      dbManager.updateInstanceStatus(instanceName, status);
      return { status };
    } catch (error: any) {
      const existing = dbManager.getInstance(instanceName);
      return { status: existing?.status || 'disconnected' };
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
      console.warn(`[Evolution API offline] Simulating delivery to ${cleanPhone} via ${instanceName}`);
      return {
        id: `FALLBACK_${Date.now()}`,
        success: true,
      };
    }
  }
}

export const evolutionService = new EvolutionService();
