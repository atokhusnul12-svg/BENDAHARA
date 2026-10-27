'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import LoginScreen from '@/components/LoginScreen';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isAdmin, authLoading } = useApp();

  // Loading state saat memeriksa session cookie
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-surface">
        <div className="w-16 h-16 rounded-2xl bg-white p-2.5 shadow-md border border-surface-container flex items-center justify-center mb-4 animate-pulse">
          <img
            src="/logo.png"
            alt="Logo Bendahara MMD"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
          Bendahara MMD
        </p>
        <p className="text-body-sm text-on-surface-variant mt-1 font-medium">
          Memeriksa sesi masuk...
        </p>
      </div>
    );
  }

  // Jika belum login, tampilkan layar login eksklusif di awal
  if (!isAdmin) {
    return <LoginScreen />;
  }

  // Jika sudah terautentikasi, tampilkan seluruh antarmuka aplikasi kas tanpa hambatan
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-28 md:pb-12 bg-surface">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
