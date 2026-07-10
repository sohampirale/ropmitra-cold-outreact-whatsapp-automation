export interface UserProfile {
  id: number;
  name: string;
  email: string;
  instance_name: string;
  instanceStatus: 'disconnected' | 'connecting' | 'open';
  phoneConnected: string | null;
  qrCode: string | null;
}

export interface CSVPreviewRow {
  phone: string;
  message: string;
  isValid: boolean;
  reason?: string;
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
