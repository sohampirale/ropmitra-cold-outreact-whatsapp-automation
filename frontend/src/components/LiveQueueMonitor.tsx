import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Pause, XCircle, Download, CheckCircle, Clock, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { Campaign, QueueMessage, UserProfile } from '../types';

interface Props {
  activeUser: UserProfile;
}

export const LiveQueueMonitor: React.FC<Props> = ({ activeUser }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextSendCountDown, setNextSendCountDown] = useState<number | null>(null);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(() => {
      fetchCampaigns(true);
      if (selectedCampaignId) {
        fetchMessages(selectedCampaignId, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeUser.id]);

  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
      fetchMessages(campaigns[0].id);
    }
  }, [campaigns]);

  useEffect(() => {
    // Calculate live countdown to next scheduled message
    if (!messages.length) {
      setNextSendCountDown(null);
      return;
    }
    const pendingMsgs = messages
      .filter((m) => m.status === 'PENDING')
      .sort((a, b) => a.scheduled_at - b.scheduled_at);

    if (pendingMsgs.length === 0) {
      setNextSendCountDown(null);
      return;
    }

    const nextMsg = pendingMsgs[0];
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = nextMsg.scheduled_at - now;
      setNextSendCountDown(diff > 0 ? diff : 0);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [messages]);

  const fetchCampaigns = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get('/api/campaigns', { params: { userId: activeUser.id } });
      if (res.data.success) {
        setCampaigns(res.data.campaigns);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMessages = async (campaignId: number, silent = false) => {
    try {
      const res = await axios.get(`/api/campaigns/${campaignId}`);
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCampaign = (id: number) => {
    setSelectedCampaignId(id);
    fetchMessages(id);
  };

  const handleUpdateStatus = async (id: number, status: 'RUNNING' | 'PAUSED' | 'CANCELLED') => {
    try {
      await axios.post(`/api/campaigns/${id}/status`, { status });
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCsv = (id: number) => {
    window.location.href = `/api/campaigns/${id}/export`;
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-green" />
            Live Queue & Campaign Monitor
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time tracking of automated WhatsApp deliveries, rate-limit timers, and background execution status.
          </p>
        </div>

        <button
          onClick={() => fetchCampaigns()}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-dark-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <Clock className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No Active Campaigns Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            Head to the Campaign Builder to upload a CSV and launch your first WhatsApp automation campaign.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel: Campaigns list */}
          <div className="glass-card rounded-2xl p-4 lg:col-span-1 border border-slate-800 space-y-3 max-h-[680px] overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-300 px-2 pb-2 border-b border-slate-800">
              Your Campaigns ({campaigns.length})
            </h3>

            {campaigns.map((camp) => {
              const isSelected = camp.id === selectedCampaignId;
              const progressPct =
                camp.total_messages > 0
                  ? Math.round(((camp.sent_messages + camp.failed_messages) / camp.total_messages) * 100)
                  : 0;

              return (
                <div
                  key={camp.id}
                  onClick={() => handleSelectCampaign(camp.id)}
                  className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                    isSelected
                      ? 'border-brand-green/50 bg-brand-green/10 shadow-sm'
                      : 'border-slate-800 bg-dark-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate max-w-[150px]">{camp.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                        camp.status === 'RUNNING'
                          ? 'bg-brand-green/20 text-brand-green border border-brand-green/40'
                          : camp.status === 'PAUSED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : camp.status === 'COMPLETED'
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                      <span>Progress: {progressPct}%</span>
                      <span>{camp.sent_messages} sent / {camp.total_messages} total</span>
                    </div>
                    <div className="w-full bg-dark-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-brand-green to-brand-emerald h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right panel: Campaign details & live message logs */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-3 border border-slate-800 flex flex-col justify-between">
            {selectedCampaign ? (
              <div className="space-y-6">
                {/* Campaign Header banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedCampaign.name}</span>
                      <span className="text-xs font-normal text-slate-400">
                        (Interval: {selectedCampaign.interval_seconds}s)
                      </span>
                    </h2>
                    {nextSendCountDown !== null && selectedCampaign.status === 'RUNNING' && (
                      <p className="mt-1 text-xs text-brand-green flex items-center gap-1.5 font-mono">
                        <Clock className="h-3.5 w-3.5 animate-pulse" />
                        <span>Next message sends in <strong>{nextSendCountDown}s</strong></span>
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2">
                    {selectedCampaign.status === 'RUNNING' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedCampaign.id, 'PAUSED')}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause Queue
                      </button>
                    )}
                    {selectedCampaign.status === 'PAUSED' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedCampaign.id, 'RUNNING')}
                        className="flex items-center gap-1.5 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-1.5 text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-all"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume Queue
                      </button>
                    )}
                    {['RUNNING', 'PAUSED'].includes(selectedCampaign.status) && (
                      <button
                        onClick={() => handleUpdateStatus(selectedCampaign.id, 'CANCELLED')}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleExportCsv(selectedCampaign.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 text-xs font-semibold text-brand-cyan hover:bg-brand-cyan/20 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Metrics Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-800 bg-dark-900 p-3.5">
                    <span className="text-[11px] font-medium text-slate-400">Total Queued</span>
                    <p className="mt-1 text-lg font-bold text-white font-mono">{selectedCampaign.total_messages}</p>
                  </div>
                  <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-3.5">
                    <span className="text-[11px] font-medium text-brand-green">Successfully Sent</span>
                    <p className="mt-1 text-lg font-bold text-brand-green font-mono">{selectedCampaign.sent_messages}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                    <span className="text-[11px] font-medium text-amber-400">Pending in Queue</span>
                    <p className="mt-1 text-lg font-bold text-amber-400 font-mono">{selectedCampaign.pending_messages}</p>
                  </div>
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3.5">
                    <span className="text-[11px] font-medium text-red-400">Failed / Errors</span>
                    <p className="mt-1 text-lg font-bold text-red-400 font-mono">{selectedCampaign.failed_messages}</p>
                  </div>
                </div>

                {/* Messages Table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">
                    Message Queue & Status Trail
                  </h3>
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-800 bg-dark-900">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-dark-800 text-slate-300 border-b border-slate-800">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Recipient Phone</th>
                          <th className="p-3">Message Text</th>
                          <th className="p-3">Scheduled / Sent At</th>
                          <th className="p-3 text-right">Delivery Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {messages.map((m, idx) => (
                          <tr key={m.id} className="hover:bg-dark-800/50">
                            <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="p-3 font-mono text-brand-green font-semibold">{m.phone}</td>
                            <td className="p-3 text-slate-300 max-w-xs truncate" title={m.message}>
                              {m.message}
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[11px]">
                              {m.status === 'SENT' && m.sent_at
                                ? new Date(m.sent_at).toLocaleTimeString()
                                : new Date(m.scheduled_at * 1000).toLocaleTimeString()}
                            </td>
                            <td className="p-3 text-right">
                              {m.status === 'SENT' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 border border-brand-green/30 px-2.5 py-0.5 text-[10px] font-semibold text-brand-green">
                                  <CheckCircle className="h-3 w-3" />
                                  Sent
                                </span>
                              ) : m.status === 'PENDING' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-red-400"
                                  title={m.error_message || 'Failed'}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  Failed
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
