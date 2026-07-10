import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Send, CheckCircle2, AlertCircle, Clock, FileSpreadsheet, Download, Sparkles } from 'lucide-react';
import { CSVPreviewRow, UserProfile } from '../types';

interface Props {
  activeUser: UserProfile;
  onCampaignCreated: () => void;
  onOpenConnectModal: () => void;
}

export const CampaignBuilder: React.FC<Props> = ({
  activeUser,
  onCampaignCreated,
  onOpenConnectModal,
}) => {
  const [campaignName, setCampaignName] = useState('Cold Outreach Campaign - ' + new Date().toLocaleDateString());
  const [intervalSeconds, setIntervalSeconds] = useState<number>(300); // 300 seconds = 5 minutes
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<CSVPreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSuccessMsg(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('csv', selectedFile);

    try {
      const res = await axios.post('/api/campaigns/preview-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setPreviewRows(res.data.rows);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse uploaded CSV file.');
      setPreviewRows([]);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const sampleData = `phone,msg\n+919876543210,"Hi! We are exploring WhatsApp outreach automation with Ropmitra."\n+919812345678,"Hello, checking if you'd be interested in our Cold Outreach services."\n+919900011122,"Hey there! Just wanted to share our latest product updates with you."\n`;
    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ropmitra_sample_outreach.csv';
    link.click();
  };

  const handleSendCampaign = async () => {
    const validRows = previewRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('Please upload a CSV file with at least 1 valid row.');
      return;
    }

    if (!campaignName.trim()) {
      setError('Please enter a campaign name.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await axios.post('/api/campaigns', {
        userId: activeUser.id,
        name: campaignName,
        intervalSeconds,
        messages: validRows.map((r) => ({ phone: r.phone, message: r.message })),
      });

      if (res.data.success) {
        setSuccessMsg(`Launched campaign "${campaignName}" with ${validRows.length} messages in background queue!`);
        setPreviewRows([]);
        setFile(null);
        onCampaignCreated();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to launch WhatsApp campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = previewRows.filter((r) => r.isValid).length;
  const invalidCount = previewRows.length - validCount;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-green" />
            WhatsApp Cold Outreach Automation
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Upload your CSV list (Phone & Message) and our lightweight background queue will automatically send 1 message every 5 minutes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSampleCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-dark-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-all"
          >
            <Download className="h-4 w-4 text-brand-cyan" />
            Sample CSV Template
          </button>
        </div>
      </div>

      {/* Connection warning if not connected */}
      {activeUser.instanceStatus !== 'open' && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-semibold">WhatsApp is not linked yet for "{activeUser.name}".</span> Messages will stay queued until your WhatsApp is scanned or connected.
            </div>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-dark-900 hover:brightness-110 transition-all"
          >
            Scan QR Now
          </button>
        </div>
      )}

      {/* Campaign Form Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Campaign Configuration */}
        <div className="glass-card rounded-2xl p-6 space-y-5 md:col-span-1 border border-slate-800">
          <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
            1. Campaign Settings
          </h3>

          <div>
            <label className="text-xs font-medium text-slate-300">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-dark-900 px-3.5 py-2 text-xs text-white focus:border-brand-green focus:outline-none"
              placeholder="e.g. Q3 Outreach List"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-green" />
                Send Interval
              </span>
              <span className="text-[11px] font-mono text-brand-green">
                {intervalSeconds === 300 ? '1 msg / 5 mins' : `${intervalSeconds} seconds`}
              </span>
            </label>
            <select
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-dark-900 px-3.5 py-2 text-xs text-white focus:border-brand-green focus:outline-none"
            >
              <option value={300}>Every 5 Minutes (300s - Recommended Safe Rate)</option>
              <option value={180}>Every 3 Minutes (180s)</option>
              <option value={60}>Every 1 Minute (60s - Testing)</option>
              <option value={10}>Every 10 Seconds (Fast Testing)</option>
            </select>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Sending 1 message per 5 minutes prevents WhatsApp automated ban systems.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">CSV Format Requirements</h4>
            <div className="rounded-xl bg-dark-900 p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1.5 font-mono">
              <div>&bull; <span className="text-brand-green font-semibold">Column 1</span>: phone (e.g. +919876543210)</div>
              <div>&bull; <span className="text-brand-cyan font-semibold">Column 2</span>: msg (Your custom message text)</div>
            </div>
          </div>
        </div>

        {/* Right column: CSV Upload & Preview */}
        <div className="glass-card rounded-2xl p-6 md:col-span-2 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 mb-4">
              2. Upload Outreach CSV List
            </h3>

            {/* Drag drop area */}
            <label className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-dark-900/60 p-8 text-center cursor-pointer hover:border-brand-green/60 hover:bg-dark-900 transition-all">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 group-hover:bg-brand-green/20 text-slate-300 group-hover:text-brand-green transition-colors mb-3">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold text-white group-hover:text-brand-green">
                {file ? file.name : 'Click to select CSV or drag and drop here'}
              </span>
              <span className="mt-1 text-[11px] text-slate-400">
                Supports any CSV with 'phone' and 'msg' columns
              </span>
            </label>

            {/* Error or Success banners */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 rounded-xl border border-brand-green/40 bg-brand-green/10 p-3 text-xs text-brand-green flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-semibold text-slate-300">
                    Parsed Preview ({validCount} valid, {invalidCount} invalid)
                  </span>
                  <span className="text-slate-400">Showing top rows</span>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-dark-900">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-dark-800 text-slate-300 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Phone Number</th>
                        <th className="p-2.5">Message Content</th>
                        <th className="p-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {previewRows.slice(0, 15).map((row, i) => (
                        <tr key={i} className="hover:bg-dark-800/50">
                          <td className="p-2.5 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-2.5 font-mono text-brand-green font-medium">{row.phone}</td>
                          <td className="p-2.5 text-slate-300 max-w-xs truncate">{row.message}</td>
                          <td className="p-2.5 text-right">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 border border-brand-green/30 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                                {row.reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Big SEND Button */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {previewRows.length > 0 ? (
                <span>Ready to schedule <strong className="text-brand-green">{validCount}</strong> messages</span>
              ) : (
                <span>Upload a CSV to enable campaign launch</span>
              )}
            </div>

            <button
              onClick={handleSendCampaign}
              disabled={submitting || validCount === 0}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                validCount > 0
                  ? 'bg-gradient-to-r from-brand-green to-brand-emerald text-dark-900 shadow-glow-green hover:brightness-110 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Send Campaign ({validCount} Msgs)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
