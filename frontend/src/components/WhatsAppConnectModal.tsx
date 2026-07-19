import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QrCode, CheckCircle2, RefreshCw, Smartphone, X, ShieldAlert, Zap } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeUser: UserProfile;
  isMockMode: boolean;
  onStatusUpdated: () => void;
}

export const WhatsAppConnectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeUser,
  isMockMode,
  onStatusUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(activeUser.qrCode);
  const [status, setStatus] = useState<'open' | 'connecting' | 'disconnected'>(
    activeUser.instanceStatus
  );
  const [phone, setPhone] = useState<string | null>(activeUser.phoneConnected);
  const [mockPhoneInput, setMockPhoneInput] = useState('+919876543210');

  useEffect(() => {
    if (!isOpen) return;
    fetchQrCode();
    const pollInterval = setInterval(() => {
      checkStatus();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [isOpen, activeUser.instance_name]);

  const fetchQrCode = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/instances/${activeUser.instance_name}/connect`);
      if (res.data.success) {
        setStatus(res.data.status);
        if (res.data.qrCode) setQrCode(res.data.qrCode);
        if (res.data.phoneConnected) setPhone(res.data.phoneConnected);
      }
    } catch (error) {
      console.error('Failed to generate QR:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await axios.get(`/api/instances/${activeUser.instance_name}/status`);
      if (res.data.success) {
        setStatus(res.data.status);
        if (res.data.phoneConnected) setPhone(res.data.phoneConnected);
        if (res.data.status === 'open') {
          onStatusUpdated();
        } else if (res.data.status === 'connecting') {
          // Keep QR code updated with fresh token from Evolution API
          const connRes = await axios.get(`/api/instances/${activeUser.instance_name}/connect`);
          if (connRes.data.qrCode) setQrCode(connRes.data.qrCode);
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
  };

  const handleSimulateScan = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`/api/instances/${activeUser.instance_name}/simulate-connect`, {
        phone: mockPhoneInput,
      });
      if (res.data.success) {
        setStatus('open');
        setPhone(res.data.phoneConnected);
        onStatusUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/instances/${activeUser.instance_name}/logout`);
      setStatus('disconnected');
      setQrCode(null);
      setPhone(null);
      onStatusUpdated();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="glass-card relative w-full max-w-md rounded-2xl border border-slate-700/80 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/20 text-brand-green">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Connect WhatsApp</h3>
            <p className="text-xs text-slate-400">
              Instance: <span className="text-brand-green font-mono">{activeUser.instance_name}</span>
            </p>
          </div>
        </div>

        <div className="py-6">
          {status === 'open' ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/20 text-brand-green ring-8 ring-brand-green/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white">WhatsApp Connected!</h4>
                <p className="mt-1 text-sm text-slate-300">
                  Phone: <span className="font-mono text-brand-green font-semibold">{phone || '+91 Linked'}</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  You are ready to upload CSV lists and send campaigns automatically.
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all"
              >
                Disconnect Session
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-dark-900 p-3 shadow-inner">
                {loading && !qrCode ? (
                  <div className="flex flex-col items-center text-slate-400">
                    <RefreshCw className="h-8 w-8 animate-spin text-brand-green mb-2" />
                    <span className="text-xs">Generating QR Code...</span>
                  </div>
                ) : qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="h-full w-full rounded-xl object-contain" />
                ) : (
                  <div className="text-center text-xs text-slate-400 px-4">
                    Click Refresh below to generate Evolution API QR Code
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Smartphone className="h-4 w-4 text-brand-green" />
                <span>Open WhatsApp on your phone &rarr; Linked Devices &rarr; Link a Device</span>
              </div>

              <div className="flex w-full items-center justify-between pt-2">
                <button
                  onClick={fetchQrCode}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh QR
                </button>

                {isMockMode && (
                  <button
                    onClick={handleSimulateScan}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-green to-brand-emerald px-4 py-2 text-xs font-semibold text-dark-900 shadow-glow-green hover:brightness-110 transition-all"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Simulate QR Scan (Dev)
                  </button>
                )}
              </div>

              {isMockMode && (
                <div className="mt-2 w-full rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 p-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-semibold text-brand-cyan mb-1">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Dev/Mock Mode Enabled</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    You can enter a mock +91 phone number below and click "Simulate QR Scan" to link instantly without scanning a real phone.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={mockPhoneInput}
                      onChange={(e) => setMockPhoneInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-dark-900 px-2.5 py-1 text-xs text-white focus:border-brand-green focus:outline-none"
                      placeholder="+919876543210"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
