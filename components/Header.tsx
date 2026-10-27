'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { syncStatus, logoutAdmin } = useApp();

  const navLinks = [
    { label: 'Beranda', href: '/', icon: 'account_balance_wallet' },
    { label: 'Laporan', href: '/laporan', icon: 'bar_chart' },
    { label: 'Subsidi', href: '/subsidi', icon: 'volunteer_activism' },
    { label: 'Pengaturan', href: '/pengaturan', icon: 'settings' },
  ];

  const getSubtitle = () => {
    if (pathname === '/laporan') return 'Laporan Pembukuan';
    if (pathname === '/subsidi') return 'Pengelolaan Subsidi';
    if (pathname === '/pengaturan') return 'Pengaturan & Sinkronisasi';
    return 'Ringkasan Kas';
  };

  const isSubPage = pathname.startsWith('/tambah') || pathname.startsWith('/edit');

  const statusColor = syncStatus?.connected
    ? 'bg-emerald-600 ring-2 ring-emerald-600/20'
    : syncStatus?.isLocalFallback
    ? 'bg-amber-500 ring-2 ring-amber-500/20'
    : 'bg-slate-400 ring-2 ring-slate-400/20';

  const statusLabel = syncStatus?.connected
    ? 'Tersinkron dengan Google Sheets'
    : syncStatus?.isLocalFallback
    ? 'Mode Offline / Lokal (Belum Sync)'
    : 'Status Koneksi: Memeriksa...';

  return (
    <header className="fixed top-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-md border-b border-surface-container-high/80 pt-safe no-print transition-colors">
      <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-6xl mx-auto w-full">
        {/* Sisi Kiri: Logo & Identitas */}
        <div className="flex items-center gap-3 min-w-0">
          {isSubPage ? (
            <button
              aria-label="Kembali"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface hover:bg-surface-container active:scale-95 transition-all -ml-1 border border-surface-container"
              onClick={() => router.back()}
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs border border-surface-variant overflow-hidden flex-shrink-0 group-hover:border-primary/40 transition-colors">
                <img
                  alt="Logo Bendahara MMD"
                  className="w-full h-full object-contain"
                  src="/logo.png"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-headline-md text-headline-md text-primary font-bold truncate tracking-tight">
                    Bendahara MMD
                  </span>
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor} transition-colors duration-200 flex-shrink-0`}
                    title={statusLabel}
                    aria-label={statusLabel}
                  />
                </div>
                <span className="text-[11px] sm:text-xs text-on-surface-variant font-medium truncate">
                  MIDA Sumbersari Kediri <span className="hidden sm:inline">• {getSubtitle()}</span>
                </span>
              </div>
            </Link>
          )}
        </div>

        {/* Tengah: Desktop Navigation Bar (md:flex) */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-container/60 p-1 rounded-xl border border-surface-container-high/60">
          {navLinks.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sisi Kanan: Status Sinkronisasi Ringkas & Tombol Keluar */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-surface-container bg-surface-container-lowest text-on-surface-variant"
            title={statusLabel}
          >
            <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
            <span>{syncStatus?.connected ? 'Tersinkron' : 'Lokal'}</span>
          </div>

          <button
            type="button"
            onClick={logoutAdmin}
            title="Keluar dari akun Bendahara MMD"
            aria-label="Keluar"
            className="h-9 px-3 rounded-lg border border-surface-variant bg-surface-container-lowest hover:bg-error-container/40 hover:border-error/30 text-on-surface-variant hover:text-error text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[17px]">logout</span>
            <span className="hidden xs:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
