'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function LoginScreen() {
  const { loginAdmin } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Silakan masukkan Username.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Silakan masukkan Kata Sandi.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const result = await loginAdmin(username.trim(), password.trim());
      if (!result.success) {
        setErrorMessage(result.error || 'Username atau Kata Sandi salah.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi gangguan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-surface text-on-surface">
      {/* Container Login */}
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Card Utama */}
        <div className="w-full bg-white rounded-2xl p-7 sm:p-8 shadow-sm border border-surface-variant relative overflow-hidden">
          {/* Header Identitas */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-18 h-18 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xs border border-surface-variant ring-1 ring-primary/10 mb-3">
              <img
                src="/logo.png"
                alt="Logo Bendahara MMD - MIDA Sumbersari"
                className="w-14 h-14 object-contain"
              />
            </div>
            <h1 className="font-headline-lg text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Bendahara MMD
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-0.5">
              Majelis Musyawarah & Dirosah
            </p>
            <span className="inline-block px-2.5 py-0.5 mt-2 bg-primary/8 text-primary font-label-sm text-[11px] font-semibold rounded-full border border-primary/15">
              MIDA Sumbersari Kediri
            </span>
          </div>

          {/* Form Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field Username */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface font-semibold mb-1.5">
                Username
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Masukkan Username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface font-medium text-body-md focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase tracking-wider"
                  autoCapitalize="characters"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Field Password */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface font-semibold mb-1.5">
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Masukkan Kata Sandi"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface font-medium text-body-md focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface p-1 rounded-md transition-colors"
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Pesan Error */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs animate-in fade-in duration-150">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">
                  error
                </span>
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Tombol Masuk */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/95 text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">
                    progress_activity
                  </span>
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">login</span>
                  <span>Masuk ke Buku Kas</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-on-surface-variant/60 font-normal">
          Sesi aktif otomatis 8 jam • Terenkripsi HMAC SHA-256
        </p>
      </div>
    </div>
  );
}
