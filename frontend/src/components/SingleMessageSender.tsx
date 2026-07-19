import React, { useState } from 'react';
import axios from 'axios';
import { Send, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Zap, Clock, MessageSquare } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
  activeUser: UserProfile;
  onMessageSent?: () => void;
}

export const SingleMessageSender: React.FC<Props> = ({ activeUser, onMessageSent }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a phone number and message.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await axios.post('/api/messages/send-single', {
        userId: activeUser.id,
        instanceName: activeUser.instance_name,
        phone,
        message,
        sendNow,
      });

      if (res.data.success) {
        if (sendNow) {
          setFeedback({
            type: 'success',
            text: `Message sent successfully to ${res.data.sentTo || phone}!`,
          });
        } else {
          setFeedback({
            type: 'success',
            text: `Message queued for ${res.data.scheduledFor || phone} and will be sent automatically.`,
          });
        }
        setMessage('');
        if (onMessageSent) onMessageSent();
      }
    } catch (err: any) {
      console.error('Send error:', err);
      const errText = err.response?.data?.error || err.message || 'Failed to send message.';
      setFeedback({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card relative rounded-2xl border border-slate-700/80 p-6 shadow-2xl animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-green/20 to-brand-emerald/20 text-brand-green border border-brand-green/30">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Direct WhatsApp Sender</h2>
            <p className="text-xs text-slate-400">
              Send instant 1-to-1 messages or schedule single messages via <span className="text-brand-green font-mono">{activeUser.instance_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
          <span>Active: <span className="font-semibold text-white">{activeUser.name}</span></span>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        {/* Phone Number Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Recipient Phone Number
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Smartphone className="h-4 w-4 text-brand-green" />
            </div>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210 or +919876543210"
              className="w-full rounded-xl border border-slate-700 bg-dark-900/90 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:outline-none transition-all"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            10-digit Indian numbers auto-prefix with +91. E.164 international numbers supported.
          </p>
        </div>

        {/* Message Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Message Content
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              {message.length} chars
            </span>
          </div>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your WhatsApp message here..."
            className="w-full rounded-xl border border-slate-700 bg-dark-900/90 p-3.5 text-sm text-white placeholder-slate-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:outline-none transition-all resize-none"
          />
        </div>

        {/* Send Mode Selection */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {sendNow ? (
              <Zap className="h-4 w-4 text-brand-green" />
            ) : (
              <Clock className="h-4 w-4 text-brand-cyan" />
            )}
            <div>
              <span className="font-semibold text-white">
                {sendNow ? 'Send Immediately' : 'Queue in Background Worker'}
              </span>
              <p className="text-[11px] text-slate-400">
                {sendNow
                  ? 'Delivers directly via WhatsApp API now'
                  : 'Queues item to be sent by background SQLite worker'}
              </p>
            </div>
          </div>

          <div className="flex items-center rounded-lg bg-dark-900 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSendNow(true)}
              className={`rounded-md px-3 py-1 font-medium transition-all ${
                sendNow ? 'bg-brand-green text-dark-900 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setSendNow(false)}
              className={`rounded-md px-3 py-1 font-medium transition-all ${
                !sendNow ? 'bg-brand-cyan text-dark-900 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Queue
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs animate-fadeIn ${
              feedback.type === 'success'
                ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                : 'border-red-500/40 bg-red-500/10 text-red-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div>{feedback.text}</div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || activeUser.instanceStatus !== 'open'}
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-lg ${
            activeUser.instanceStatus !== 'open'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-brand-green to-brand-emerald text-dark-900 shadow-glow-green hover:brightness-110 active:scale-[0.99]'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Processing Message...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>
                {activeUser.instanceStatus !== 'open'
                  ? 'Connect WhatsApp to Send'
                  : sendNow
                  ? 'Send WhatsApp Message Now'
                  : 'Add to Outreach Queue'}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
