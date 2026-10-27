'use client';

import React from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, loading]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
      className="fixed inset-0 z-[100] bg-ink-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
    >
      <div className="w-full max-w-[420px] bg-white border border-border rounded-t-3xl sm:rounded-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto">
        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[26px]">warning</span>
        </div>

        <div className="flex flex-col text-center">
          <h3 className="text-lg text-ink-900 font-bold tracking-tight">{title}</h3>
          <p className="text-xs sm:text-sm text-ink-500 mt-1.5 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl bg-surface-subtle hover:bg-neutral-200 text-ink-800 border border-border font-medium text-sm active:scale-95 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>Ya, Hapus</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
