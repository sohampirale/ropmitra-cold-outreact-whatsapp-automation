import React, { useState } from 'react';
import { MessageSquare, Users, PlusCircle, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
  users: UserProfile[];
  activeUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onCreateUser: (name: string, email: string) => Promise<void>;
  onOpenConnectModal: () => void;
  activeTab: 'builder' | 'monitor' | 'history';
  setActiveTab: (tab: 'builder' | 'monitor' | 'history') => void;
  isMockMode: boolean;
}

export const Header: React.FC<Props> = ({
  users,
  activeUser,
  onSelectUser,
  onCreateUser,
  onOpenConnectModal,
  activeTab,
  setActiveTab,
  isMockMode,
}) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    setLoading(true);
    try {
      await onCreateUser(newUserName, newUserEmail);
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUser(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-dark-900/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-green to-brand-emerald shadow-glow-green text-dark-900 font-bold">
              <MessageSquare className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  ROPMITRA
                </span>
                <span className="rounded-full bg-brand-green/10 border border-brand-green/30 px-2 py-0.5 text-[10px] font-semibold text-brand-green uppercase tracking-wider">
                  Outreach AI
                </span>
                {isMockMode && (
                  <span className="rounded-full bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-0.5 text-[10px] font-semibold text-brand-cyan">
                    Dev Mock
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Lightweight Evolution API & SQLite Background Worker
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 rounded-xl bg-dark-800/80 border border-slate-800 p-1">
            <button
              onClick={() => setActiveTab('builder')}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'builder'
                  ? 'bg-gradient-to-r from-brand-green/20 to-brand-emerald/10 text-brand-green border border-brand-green/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Campaign Builder
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'monitor'
                  ? 'bg-gradient-to-r from-brand-green/20 to-brand-emerald/10 text-brand-green border border-brand-green/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Queue Monitor
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-brand-green/20 to-brand-emerald/10 text-brand-green border border-brand-green/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit & CSV Exports
            </button>
          </nav>

          {/* User Profile Switcher & WhatsApp Connect Status */}
          <div className="flex items-center gap-3">
            {/* User Switcher */}
            <div className="relative flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <select
                value={activeUser?.id || ''}
                onChange={(e) => {
                  const found = users.find((u) => u.id === Number(e.target.value));
                  if (found) onSelectUser(found);
                }}
                className="rounded-xl border border-slate-700 bg-dark-800 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-brand-green focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.instance_name})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowAddUser(true)}
                title="Add New User Profile"
                className="rounded-xl border border-slate-700 bg-dark-800 p-1.5 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-brand-green" />
              </button>
            </div>

            {/* Connect Button Indicator */}
            {activeUser && (
              <button
                onClick={onOpenConnectModal}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeUser.instanceStatus === 'open'
                    ? 'border-brand-green/40 bg-brand-green/10 text-brand-green shadow-glow-green/20 hover:bg-brand-green/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                {activeUser.instanceStatus === 'open' ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-brand-green animate-pulse" />
                    <span>Connected ({activeUser.phoneConnected || 'Active'})</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                    <span>Connect WhatsApp QR</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-800 py-2">
          <button
            onClick={() => setActiveTab('builder')}
            className={`text-xs font-medium ${activeTab === 'builder' ? 'text-brand-green' : 'text-slate-400'}`}
          >
            Campaign Builder
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`text-xs font-medium ${activeTab === 'monitor' ? 'text-brand-green' : 'text-slate-400'}`}
          >
            Monitor
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs font-medium ${activeTab === 'history' ? 'text-brand-green' : 'text-slate-400'}`}
          >
            Audit & Export
          </button>
        </div>
      </div>

      {/* Add User Profile Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl border border-slate-700 p-6">
            <h3 className="text-base font-semibold text-white">Add New User / Team Member</h3>
            <p className="mt-1 text-xs text-slate-400">
              Create a multi-user profile with its own dedicated WhatsApp instance.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300">Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-dark-900 px-3 py-2 text-xs text-white focus:border-brand-green focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. rahul@ropmitra.com"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-dark-900 px-3 py-2 text-xs text-white focus:border-brand-green focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-brand-green px-4 py-1.5 text-xs font-semibold text-dark-900 shadow-glow-green hover:brightness-110"
                >
                  {loading ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
