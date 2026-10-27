'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onVerifyPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
}

export default function AdminPinModal({
  isOpen,
  onClose,
  onSuccess,
  onVerifyPin,
}: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Silakan masukkan PIN Bendahara.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await onVerifyPin(pin.trim());
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'PIN Bendahara salah. Akses ditolak.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi gangguan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-surface-container animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>

          <h3 className="font-headline-sm text-headline-sm text-center text-on-surface font-bold mb-1">
            Autentikasi Bendahara
          </h3>
          <p className="font-body-sm text-body-sm text-center text-on-surface-variant mb-5">
            Operasi ini mengubah buku kas. Masukkan PIN keamanan Bendahara untuk melanjutkan.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Masukkan 6-digit PIN"
                  className="w-full text-center text-2xl tracking-widest font-mono py-3 px-4 rounded-xl border border-outline/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-surface-container-low text-on-surface"
                  disabled={loading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 hover:text-on-surface p-1"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPin ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {error && (
                <div className="mt-2.5 flex items-center gap-1.5 text-error text-xs font-medium bg-error/10 p-2.5 rounded-lg border border-error/20">
                  <span className="material-symbols-outlined text-[16px] flex-shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-outline/30 text-on-surface font-label-md text-label-md hover:bg-surface-container active:scale-98 transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !pin.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary/95 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Memeriksa...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    <span>Verifikasi</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-center text-on-surface-variant/70 mt-4">
            PIN default awal: <code className="bg-surface-container px-1 py-0.5 rounded font-mono">144805</code> (dapat diubah di konfigurasi server).
          </p>
        </div>
      </div>
    </div>
  );
}
