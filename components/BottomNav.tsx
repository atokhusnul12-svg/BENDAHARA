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
              className={`flex flex-col items-center justify-center gap-space-xs min-w-[56px] min-h-[44px] transition-colors active:scale-95 ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-label-sm text-label-sm leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
