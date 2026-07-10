import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { WhatsAppConnectModal } from './components/WhatsAppConnectModal';
import { CampaignBuilder } from './components/CampaignBuilder';
import { LiveQueueMonitor } from './components/LiveQueueMonitor';
import { HistoryAudit } from './components/HistoryAudit';
import { UserProfile } from './types';

export const App: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'monitor' | 'history'>('builder');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      const loadedUsers: UserProfile[] = res.data.users || [];
      setIsMockMode(Boolean(res.data.isMockMode));
      setUsers(loadedUsers);
      if (loadedUsers.length > 0 && !activeUser) {
        setActiveUser(loadedUsers[0]);
      } else if (activeUser) {
        const refreshed = loadedUsers.find((u) => u.id === activeUser.id);
        if (refreshed) setActiveUser(refreshed);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateUser = async (name: string, email: string) => {
    await axios.post('/api/users', { name, email });
    await fetchUsers();
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100">
      <Header
        users={users}
        activeUser={activeUser}
        onSelectUser={(u) => setActiveUser(u)}
        onCreateUser={handleCreateUser}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMockMode={isMockMode}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {!activeUser ? (
          <div className="text-center py-16 text-xs text-slate-400">Loading user profiles...</div>
        ) : (
          <>
            {activeTab === 'builder' && (
              <CampaignBuilder
                activeUser={activeUser}
                onCampaignCreated={() => setActiveTab('monitor')}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
              />
            )}
            {activeTab === 'monitor' && <LiveQueueMonitor activeUser={activeUser} />}
            {activeTab === 'history' && <HistoryAudit activeUser={activeUser} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-dark-900/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Ropmitra Outreach Automation Platform. All rights reserved.</span>
          <span>1 Message / 5 Minutes Queue Architecture &bull; Powered by Evolution API &amp; SQLite</span>
        </div>
      </footer>

      {activeUser && (
        <WhatsAppConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          activeUser={activeUser}
          isMockMode={isMockMode}
          onStatusUpdated={() => fetchUsers()}
        />
      )}
    </div>
  );
};
