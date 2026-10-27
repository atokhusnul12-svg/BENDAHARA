'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { syncStatus, logoutAdmin } = useApp();

  const getSubtitle = () => {
    if (pathname === '/laporan') return 'Laporan';
    if (pathname === '/subsidi') return 'Subsidi';
    if (pathname === '/pengaturan') return 'Pengaturan';
    return 'Beranda';
  };

  const isSubPage = pathname.startsWith('/tambah') || pathname.startsWith('/edit');

  const statusColor = syncStatus?.connected
    ? 'bg-emerald-500 ring-2 ring-emerald-500/25'
    : syncStatus?.isLocalFallback
    ? 'bg-amber-400 ring-2 ring-amber-400/25'
    : 'bg-slate-400 ring-2 ring-slate-400/25';

  const statusLabel = syncStatus?.connected
    ? 'Tersinkron dengan Google Sheets'
    : syncStatus?.isLocalFallback
    ? 'Mode Offline / Lokal (Belum Sync)'
    : 'Status Koneksi: Memeriksa...';

  return (
    <header className="fixed top-0 inset-x-0 z-30 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe no-print">
      <div className="h-16 px-gutter flex items-center justify-between max-w-[480px] mx-auto w-full">
        <div className="flex items-center gap-space-sm min-w-0">
          {isSubPage ? (
            <button
              aria-label="Kembali"
              className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-95 transition-all -ml-2"
              onClick={() => router.back()}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs border border-surface-container overflow-hidden flex-shrink-0">
              <img
                alt="Logo Bendahara MMD - MIDA Sumbersari"
                className="w-full h-full object-contain"
                src="/logo.png"
              />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-md text-headline-md text-primary font-bold truncate tracking-tight">
                Bendahara MMD
              </span>
              <span
                className={`inline-block w-2 h-2 rounded-full ${statusColor} transition-colors duration-200 flex-shrink-0`}
                title={statusLabel}
                aria-label={statusLabel}
              />
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              MIDA Sumbersari Kediri • {getSubtitle()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={logoutAdmin}
            title="Keluar dari akun Bendahara MMD"
            aria-label="Keluar"
            className="h-8 px-2.5 rounded-lg border border-surface-container bg-surface-container-low hover:bg-error/10 hover:border-error/30 text-on-surface-variant hover:text-error text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar</span>
          </button>

          <div
            className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shadow-xs ring-1 ring-primary/20 overflow-hidden"
            title="Insignia Institusi MMD MIDA Sumbersari"
            aria-label="Logo MIDA"
          >
            <img
              alt="Logo MIDA"
              className="w-full h-full object-contain"
              src="/logo.png"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
