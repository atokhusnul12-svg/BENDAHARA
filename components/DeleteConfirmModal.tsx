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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-surface-container-lowest rounded-2xl p-space-lg shadow-2xl flex flex-col gap-space-md animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-error-container/40 text-error flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[28px]">warning</span>
        </div>

        <div className="flex flex-col text-center">
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold">{title}</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-space-sm pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl bg-surface-container text-on-surface font-label-lg text-label-lg active:scale-95 transition-all font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="h-11 rounded-xl bg-error text-on-error font-label-lg text-label-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 font-semibold disabled:opacity-60"
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
