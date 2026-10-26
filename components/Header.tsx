'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const getSubtitle = () => {
    if (pathname === '/laporan') return 'Laporan';
    if (pathname === '/subsidi') return 'Subsidi';
    if (pathname === '/pengaturan') return 'Pengaturan';
    return 'Beranda';
  };

  const isSubPage = pathname.startsWith('/tambah') || pathname.startsWith('/edit');

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe no-print">
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
            <img
              alt="Logo Bendahara MMD - MIDA Sumbersari"
              className="h-9 w-auto object-contain flex-shrink-0 drop-shadow-xs"
              src="/logo.png"
            />
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-md text-headline-md text-primary font-bold truncate tracking-tight">
                Bendahara MMD
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary-container"></span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              MIDA Sumbersari Kediri • {getSubtitle()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-xs flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-surface-container-low p-1 flex items-center justify-center shadow-xs ring-1 ring-primary/20 overflow-hidden">
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
