'use client';

import { useState, useCallback } from 'react';
import { AppSidebar } from '@/components/app/sidebar';
import { AppHeader } from '@/components/app/header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const handleSetSidebarOpen = useCallback((open: boolean) => setSidebarOpen(open), []);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar open={sidebarOpen} setOpen={handleSetSidebarOpen} />
      <div
        className="transition-all duration-300 min-h-screen flex flex-col"
        style={{ marginLeft: sidebarOpen ? '280px' : '80px' }}
      >
        <AppHeader sidebarOpen={sidebarOpen} setSidebarOpen={handleSetSidebarOpen} />
        <main className="flex-1 p-8 pt-24">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
