'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Beranda',
      path: '/',
      icon: 'account_balance_wallet',
    },
    {
      label: 'Laporan',
      path: '/laporan',
      icon: 'bar_chart',
    },
    {
      label: 'Subsidi',
      path: '/subsidi',
      icon: 'volunteer_activism',
    },
    {
      label: 'Pengaturan',
      path: '/pengaturan',
      icon: 'settings',
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 pb-safe bg-surface/95 backdrop-blur-lg border-t border-surface-container-high/90 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] md:hidden no-print">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map(item => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-2 py-1 transition-all group ${
                isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <div
                className={`px-3.5 py-1 rounded-xl transition-all duration-150 flex items-center justify-center ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-on-surface-variant group-hover:bg-surface-container/70 group-hover:text-primary'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
              </div>
              <span className={`text-[11px] leading-tight font-medium tracking-tight ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
