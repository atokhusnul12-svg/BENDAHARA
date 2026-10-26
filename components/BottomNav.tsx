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
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-4px_16px_rgba(15,118,110,0.04)] border-t border-surface-container no-print">
      <div className="flex justify-around items-center h-16 max-w-[480px] mx-auto px-gutter">
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
                className={`px-3.5 py-1 rounded-full transition-all duration-150 flex items-center justify-center ${
                  isActive
                    ? 'bg-primary/12 text-primary shadow-xs'
                    : 'text-on-surface-variant group-hover:bg-surface-container-high/60 group-hover:text-primary'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
              </div>
              <span className={`font-label-sm text-[11px] leading-tight font-medium tracking-tight ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
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
