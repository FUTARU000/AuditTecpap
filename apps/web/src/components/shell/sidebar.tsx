'use client';

import { X } from 'lucide-react';
import { Button } from '@tecpap/ui';
import { Logo } from '@/components/brand/logo';
import { NavList } from './nav-list';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] animate-slide-in flex-col border-r border-border bg-card shadow-lg">
            <div className="flex items-center justify-between">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={onClose}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <NavList onNavigate={onClose} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarInner() {
  return (
    <>
      <Logo />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <NavList />
      </div>
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        v0.1.0 · Foundations
      </div>
    </>
  );
}
