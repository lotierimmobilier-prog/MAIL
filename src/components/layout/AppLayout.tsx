import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NewEmailModal from '../email/NewEmailModal';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 1024);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-slate-50">
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        onToggle={() => {
          if (isMobile) setMobileOpen(false);
          else setCollapsed(!collapsed);
        }}
        onCompose={() => {
          setShowCompose(true);
          setMobileOpen(false);
        }}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={`transition-all duration-300 ${
          isMobile ? 'ml-0' : collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {isMobile && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed top-3 left-3 z-30 p-2 bg-white rounded-lg shadow-md border border-slate-200"
            aria-label="Menu"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
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
