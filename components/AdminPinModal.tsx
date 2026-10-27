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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-forest-50 border border-forest-100 text-forest-700 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[26px]">lock</span>
          </div>

          <h3 className="text-lg text-center text-ink-900 font-bold tracking-tight mb-1">
            Autentikasi Bendahara
          </h3>
          <p className="text-xs text-center text-ink-500 mb-5 leading-relaxed">
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
                  className="w-full text-center text-2xl tracking-widest font-mono py-3 px-4 rounded-xl border border-border focus:border-forest-600 focus:ring-2 focus:ring-forest-600/20 outline-none transition-all bg-surface-subtle text-ink-900"
                  disabled={loading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPin ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {error && (
                <div className="mt-2.5 flex items-center gap-2 text-red-700 text-xs font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-surface-subtle hover:bg-neutral-200 border border-border text-ink-800 text-xs sm:text-sm font-medium active:scale-95 transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !pin.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs sm:text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
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

          <p className="text-[11px] text-center text-ink-400 mt-4">
            PIN default awal: <code className="bg-surface-subtle px-1.5 py-0.5 rounded border border-border text-ink-700 font-mono">144805</code>
          </p>
        </div>
      </div>
    </div>
  );
}
