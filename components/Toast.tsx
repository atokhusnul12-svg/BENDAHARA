'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

export default function Toast() {
  const { toast, hideToast } = useApp();

  if (!toast.show) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  const bgColor = isError
    ? 'bg-error text-on-error'
    : isInfo
    ? 'bg-secondary text-on-secondary'
    : 'bg-primary text-on-primary';

  const iconName = isError ? 'error' : isInfo ? 'info' : 'check_circle';

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[420px] transition-all duration-300 transform translate-y-0 opacity-100 no-print">
      <div className={`${bgColor} px-margin py-space-sm rounded-xl shadow-xl flex items-center gap-space-sm`}>
        <span
          className="material-symbols-outlined text-[20px] text-primary-fixed flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {iconName}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-label-lg text-label-lg font-semibold leading-tight truncate">
            {toast.title}
          </p>
          {toast.subtitle && (
            <p className="font-label-sm text-label-sm opacity-90 leading-tight truncate mt-0.5">
              {toast.subtitle}
            </p>
          )}
        </div>
        <button
          className="hover:opacity-80 p-1 rounded-full transition-opacity flex-shrink-0"
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
