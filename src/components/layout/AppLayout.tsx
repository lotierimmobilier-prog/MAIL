import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NewEmailModal from '../email/NewEmailModal';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onCompose={() => setShowCompose(true)}
      />
      <div
        className={`transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}
      >
        <Outlet />
      </div>

      {showCompose && (
        <NewEmailModal
          onClose={() => setShowCompose(false)}
          onSent={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
