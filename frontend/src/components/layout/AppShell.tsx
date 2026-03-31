import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAppStore } from '../../store';

export default function AppShell() {
  const collapsed = useAppStore(s => s.sidebarCollapsed);

  // Mobile drawer state — completely separate from the desktop collapsed state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const openDrawer  = useCallback(() => setMobileDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar (hidden on mobile) ───────────────────────────── */}
      <div className="hidden md:block">
        <Sidebar
          mobileDrawerOpen={false}
          onCloseDrawer={closeDrawer}
        />
      </div>

      {/* ── Mobile overlay drawer ─────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm
          md:hidden transition-opacity duration-300
          ${mobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 md:hidden
          transition-transform duration-300 ease-in-out
          ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar
          mobileDrawerOpen={mobileDrawerOpen}
          onCloseDrawer={closeDrawer}
        />
      </div>

      {/* ── Main content column ───────────────────────────────────────────── */}
      {/*
        Desktop: offset left by the sidebar width.
          collapsed  → ml-16  (4rem  = 64px)
          expanded   → ml-64  (16rem = 256px)
        Mobile: no left offset — the sidebar is an overlay and nav lives at bottom.
        Tailwind JIT requires static class strings, so we use a lookup rather than
        a dynamic template literal.
      */}
      <div
        className={
          // Base classes always applied
          'flex flex-col flex-1 overflow-hidden transition-[margin-left] duration-300 ease-in-out ' +
          // Responsive sidebar offset (desktop only)
          (collapsed ? 'md:ml-16' : 'md:ml-64')
        }
      >
        <TopBar onOpenMobileDrawer={openDrawer} />

        {/*
          Scrollable page body.
          pb-20 on mobile leaves room above the bottom nav bar (h-16 + breathing room).
        */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom navigation bar ─────────────────────────────────── */}
      {/*
        Rendered as a separate Sidebar instance in "mobileBottomNav" mode.
        AppShell owns the bottom-nav rendering so the Sidebar component
        doesn't need to know whether it's inside a drawer or not.
      */}
      <div className="md:hidden">
        <Sidebar
          mobileDrawerOpen={false}
          onCloseDrawer={closeDrawer}
          mobileBottomNav
        />
      </div>
    </div>
  );
}
