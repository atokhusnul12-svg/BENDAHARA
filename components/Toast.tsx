'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

export default function Toast() {
  const { toast, hideToast } = useApp();

  if (!toast.show) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  const containerClasses = isError
    ? 'bg-[#7F1D1D] text-white border-[#991B1B]'
    : isInfo
    ? 'bg-[#075985] text-white border-[#0369A1]'
    : 'bg-[#10382D] text-white border-[#174D3C]';

  const iconName = isError ? 'error' : isInfo ? 'info' : 'check_circle';
  const iconBadgeClasses = isError
    ? 'bg-red-950/60 text-red-200'
    : isInfo
    ? 'bg-sky-950/60 text-sky-200'
    : 'bg-emerald-950/60 text-emerald-300';

  return (
    <div className="fixed top-5 sm:top-6 left-1/2 -translate-x-1/2 z-[110] w-[92%] max-w-md transition-all duration-300 transform translate-y-0 opacity-100 no-print animate-in slide-in-from-top-4">
      <div className={`${containerClasses} px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3.5`}>
        <div className={`w-8 h-8 rounded-lg ${iconBadgeClasses} flex items-center justify-center flex-shrink-0`}>
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {iconName}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-semibold leading-tight truncate text-white">
            {toast.title}
          </p>
          {toast.subtitle && (
            <p className="text-[11px] sm:text-xs text-white/80 leading-tight truncate mt-0.5">
              {toast.subtitle}
            </p>
          )}
        </div>
        <button
          className="hover:bg-white/15 p-1 rounded-full text-white/80 hover:text-white transition-colors flex-shrink-0"
          onClick={hideToast}
          type="button"
          aria-label="Tutup notifikasi"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
