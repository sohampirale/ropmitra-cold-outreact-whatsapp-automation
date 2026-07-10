import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Download, Search, CheckCircle2, XCircle, Clock, Archive } from 'lucide-react';
import { QueueMessage, UserProfile } from '../types';

interface Props {
  activeUser: UserProfile;
}

export const HistoryAudit: React.FC<Props> = ({ activeUser }) => {
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');

  useEffect(() => {
    fetchHistory();
  }, [activeUser.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/history/all', { params: { userId: activeUser.id } });
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllCsv = () => {
    window.location.href = `/api/history/export-all?userId=${activeUser.id}`;
  };

  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Archive className="h-5 w-5 text-brand-cyan" />
            Outreach History & CSV Reference
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Full audit log of all automated messages sent from your WhatsApp instance. Export to CSV anytime.
          </p>
        </div>

        <button
          onClick={handleExportAllCsv}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan to-blue-500 px-4 py-2 text-xs font-semibold text-dark-900 shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Download className="h-4 w-4" />
          Download Complete CSV History
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search phone number or message..."
            className="w-full rounded-xl border border-slate-700 bg-dark-900 pl-9 pr-3 py-1.5 text-xs text-white focus:border-brand-green focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(['ALL', 'SENT', 'PENDING', 'FAILED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === status
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading history logs...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No history records matching your search or filters.
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto rounded-xl border border-slate-800 bg-dark-900">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-dark-800 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Recipient Phone</th>
                  <th className="p-3">Message Snippet</th>
                  <th className="p-3">Scheduled Time</th>
                  <th className="p-3">Sent Time</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-dark-800/50">
                    <td className="p-3 text-slate-500 font-mono">#{item.id}</td>
                    <td className="p-3 font-mono text-brand-green font-semibold">{item.phone}</td>
                    <td className="p-3 text-slate-300 max-w-sm truncate" title={item.message}>
                      {item.message}
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {new Date(item.scheduled_at * 1000).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {item.sent_at ? new Date(item.sent_at).toLocaleString() : 'Not sent yet'}
                    </td>
                    <td className="p-3 text-right">
                      {item.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 border border-brand-green/30 px-2.5 py-0.5 text-[10px] font-semibold text-brand-green">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent
                        </span>
                      ) : item.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-red-400"
                          title={item.error_message || ''}
                        >
                          <XCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
