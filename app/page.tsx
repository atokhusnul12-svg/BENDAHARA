'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatRupiah, formatTanggal } from '@/lib/format';
import Link from 'next/link';

export default function HomePage() {
  const {
    loading,
    pengeluaran,
    periode,
    selectedPeriode,
    setSelectedPeriode,
    summary,
    syncStatus,
    openExpenseModal,
    openSubsidyModal,
    isAdmin,
    openPinModal,
  } = useApp();

  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!periodDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [periodDropdownOpen]);

  // Filter transaksi terbaru untuk periode aktif (maksimal 5 transaksi)
  const currentPeriodExpenses = pengeluaran
    .filter(p => {
      if (!selectedPeriode || selectedPeriode === 'Semua' || selectedPeriode === 'Semua Periode') return true;
      const label = `${p.bulanHijriah || ''} ${p.tahunHijriah || ''} H`.trim().toLowerCase();
      const target = selectedPeriode.trim().toLowerCase();
      return label === target || (p.periodeId || '').trim().toLowerCase() === target;
    })
    .slice(0, 5);

  const totalSubsidi = summary?.totalSubsidi || 0;
  const totalPengeluaran = summary?.totalPengeluaran || 0;
  const saldoTersisa = summary?.saldoTersisa || 0;
  const saldoTerkonfirmasi = summary?.saldoTerkonfirmasi ?? saldoTersisa;
  const persentasePenggunaan = summary?.persentasePenggunaan || 0;
  const hasPendingSync = Boolean(summary?.hasPendingSync);

  return (
    <div className="flex flex-col w-full relative">
      {/* Section 1: Header Meta, Periode Selector & Actual Sync Status */}
      <div className="flex flex-col gap-space-sm mb-space-md pt-2">
        <div className="flex items-center justify-between gap-space-sm">
          {/* Periode Dropdown Trigger */}
          <div className="relative" ref={dropdownRef}>
            <button

              className="flex items-center gap-space-xs px-3.5 py-2 min-h-[42px] bg-surface-container-lowest rounded-full shadow-sm hover:bg-surface-container-low transition-colors text-on-surface border border-surface-container active:scale-[0.98]"
              onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                calendar_month
              </span>
              <span className="font-label-lg text-label-lg font-bold">
                {selectedPeriode || 'Pilih Periode'}
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {periodDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 flex flex-col border border-surface-container">
                <div className="px-3 py-1.5 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                  Pilih Siklus Anggaran
                </div>
                {periode.map(p => {
                  const isSelected = selectedPeriode === p.labelPeriode;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPeriode(p.labelPeriode);
                        setPeriodDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-left font-label-md text-label-md transition-colors ${
                        isSelected
                          ? 'bg-surface-container-low text-primary font-bold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <span>{p.labelPeriode}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="h-px bg-surface-container my-1"></div>
                <Link
                  href="/pengaturan"
                  className="flex items-center gap-space-xs px-3 py-2 text-left font-label-md text-label-md text-primary hover:bg-primary-fixed/20 transition-colors font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Kelola / Tambah Periode</span>
                </Link>
              </div>
            )}
          </div>

          {/* Actual Sync Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full shadow-xs flex-shrink-0 text-xs font-semibold ${
              syncStatus?.connected
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                : 'bg-amber-50 text-amber-900 border border-amber-200/80'
            }`}
            title={syncStatus?.error || 'Status sinkronisasi server'}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {syncStatus?.connected ? 'sync' : 'cloud_off'}
            </span>
            <span className="font-label-sm text-label-sm truncate max-w-[125px]">
              {syncStatus?.connected ? 'Sinkron Sheets' : 'Lokal (Belum Sync)'}
            </span>
          </div>
        </div>
      </div>

      {/* Lock Notification Banner jika belum terautentikasi */}
      {!isAdmin && (
        <div className="flex items-center justify-between gap-3 p-3.5 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-amber-700" style={{ fontVariationSettings: "'FILL' 1" }}>
              lock
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-xs">Buku Kas Internal Terkunci</span>
              <span className="text-[11px] text-amber-900/80">Masukkan PIN Bendahara untuk membuka akses penuh data keuangan.</span>
            </div>
          </div>
          <button
            onClick={() => openPinModal()}
            className="flex-shrink-0 px-3.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-xs hover:opacity-90 active:scale-95 transition-all"
          >
            Buka Kunci
          </button>
        </div>
      )}

      {/* Section 2: 'Ringkasan Total' Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-lg shadow-primary/10 p-5 mb-space-lg">
        {/* Subtle 8-Point Islamic Star / Hexagon Watermark Micro Pattern */}
        <div className="absolute -right-6 -bottom-6 w-36 h-36 opacity-[0.06] pointer-events-none text-secondary-fixed">
          <svg aria-hidden="true" className="w-full h-full fill-current" viewBox="0 0 100 100">
            <polygon points="50,0 65,35 100,50 65,65 50,100 35,65 0,50 35,35" />
            <polygon points="50,12 76,24 88,50 76,76 50,88 24,76 12,50 24,24" />
          </svg>
        </div>
        <div className="absolute -right-12 -top-12 w-28 h-28 opacity-[0.06] pointer-events-none text-secondary-fixed">
          <svg aria-hidden="true" className="w-full h-full fill-current" viewBox="0 0 100 100">
            <polygon points="50,0 65,35 100,50 65,65 50,100 35,65 0,50 35,35" />
          </svg>
        </div>

        {/* Hero Card Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
              shield_with_heart
            </span>
            <span className="font-label-md text-label-md tracking-wider uppercase font-semibold text-white">
              Ringkasan Total Anggaran
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed font-bold shadow-xs">
            Amanah MMD
          </span>
        </div>

        {/* Sisa Subsidi Primary Display */}
        <div className="mb-3.5 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-label-sm text-xs text-white/90 font-medium">
              {hasPendingSync ? 'Saldo Sementara (Termasuk Pending)' : 'Sisa Dana Kas Tersedia'}
            </span>
            {hasPendingSync ? (
              <span className="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full shadow-xs">
                {summary?.pendingCount || 1} Menunggu Sinkron
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-400/30 text-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Terkonfirmasi Sheets
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-title-currency-lg text-[28px] sm:text-[32px] text-white font-bold tracking-tight tabular-nums leading-none">
              {formatRupiah(saldoTersisa)}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${saldoTersisa >= 0 ? 'bg-secondary-fixed/90 text-on-secondary-fixed' : 'bg-error-container text-on-error-container'}`}>
              {saldoTersisa >= 0 ? 'Tersedia' : 'Defisit'}
            </span>
          </div>
          {hasPendingSync && (
            <div className="mt-1 text-xs text-white/80 font-medium">
              Saldo Terkonfirmasi Google Sheets: <strong>{formatRupiah(saldoTerkonfirmasi)}</strong>
            </div>
          )}
        </div>

        {/* Overall Linear Progress Bar with Companion Text */}
        <div className="relative z-10 mb-4">
          <div className="w-full bg-white/20 rounded-full h-2.5 p-0.5 overflow-hidden shadow-inner">
            <div
              className="bg-secondary-fixed-dim h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, persentasePenggunaan))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/90 font-medium mt-1.5">
            <span>Realisasi Anggaran</span>
            <span className="tabular-nums font-semibold">{persentasePenggunaan}% terpakai</span>
          </div>
        </div>

        {/* Stats Breakdown (Total Subsidi vs Total Pengeluaran) */}
        <div className="grid grid-cols-2 gap-3 pt-3 bg-black/15 backdrop-blur-xs rounded-xl px-3.5 py-3 relative z-10 border border-white/10">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="material-symbols-outlined text-[15px]">account_balance</span>
              <span className="font-label-sm text-xs font-medium">Total Subsidi</span>
            </div>
            <span className="font-headline-md text-base sm:text-lg font-bold mt-1 text-white tabular-nums tracking-tight">
              {formatRupiah(totalSubsidi)}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
              <span className="font-label-sm text-xs font-medium">
                Pengeluaran ({persentasePenggunaan}%)
              </span>
            </div>
            <span className="font-headline-md text-base sm:text-lg font-bold mt-1 text-secondary-fixed tabular-nums tracking-tight">
              {formatRupiah(totalPengeluaran)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-space-lg">
        <button
          onClick={() => openExpenseModal()}
          className="h-12 min-h-[44px] px-3 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all duration-150"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>Catat Pengeluaran</span>
        </button>
        <button
          onClick={() => openSubsidyModal()}
          className="h-12 min-h-[44px] px-3 py-2.5 rounded-xl bg-primary/8 text-primary border border-primary/25 hover:bg-primary/15 hover:border-primary/35 font-label-md text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">volunteer_activism</span>
          <span>Tambah Subsidi</span>
        </button>
      </div>

      {/* Section 3: Subsidized Category Summary Cards (Bento stack) */}
      <div className="flex items-center justify-between mb-space-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-headline-md text-headline-md font-bold text-on-surface">
            Alokasi Tiap Lajnah
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">pie_chart</span>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
          {summary?.categories?.length || 0} Kategori Aktif
        </span>
      </div>

      <div className="flex flex-col gap-space-sm mb-space-lg">
        {summary?.categories && summary.categories.length > 0 ? (
          summary.categories.map(cat => {
            const pct = cat.persentasePenggunaan;
            const barColor =
              pct > 90
                ? 'bg-error'
                : pct > 75
                ? 'bg-secondary-fixed-dim'
                : 'bg-primary';

            return (
              <div
                key={cat.kategoriId}
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2.5 hover:shadow-md transition-shadow border border-surface-container"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary font-bold text-[14px]">
                      <span className="material-symbols-outlined text-[18px]">
                        account_balance
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-lg text-label-lg font-bold text-on-surface leading-tight">
                        {cat.kategoriNama}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {cat.jumlahTransaksi} Transaksi
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-title-currency-md text-title-currency-md font-bold text-primary tabular-nums">
                      {formatRupiah(cat.saldoTersisa)}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant tabular-nums">
                      Plafon: {formatRupiah(cat.totalSubsidi)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1">
                  <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`${barColor} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>
                      Terpakai: <strong className="text-error tabular-nums">{formatRupiah(cat.totalPengeluaran)}</strong>
                    </span>
                    <span className="font-semibold tabular-nums">{pct}% realisasi</span>
                  </div>
                </div>

                {/* Tombol Aksi Cepat Kategori */}
                <div className="flex items-center gap-2 pt-1 border-t border-surface-container mt-0.5">
                  <button
                    type="button"
                    onClick={() => openExpenseModal({ kategoriNama: cat.kategoriNama } as any)}
                    className="flex-1 h-9 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    <span>Catat Pengeluaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubsidyModal({ kategoriNama: cat.kategoriNama } as any)}
                    className="h-9 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface-variant font-label-sm text-xs font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
                    <span>+ Subsidi</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-surface-container-lowest rounded-xl p-6 text-center text-on-surface-variant text-sm border border-surface-container">
            Belum ada kategori aktif.
          </div>
        )}
      </div>

      {/* Section 4: 'Pengeluaran Terbaru' List */}
      <div className="flex items-center justify-between mb-space-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-headline-md text-headline-md font-bold text-on-surface">
            Pengeluaran Terbaru
          </span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            history
          </span>
        </div>
        <Link
          href="/laporan"
          className="font-label-sm text-label-sm text-primary font-semibold hover:underline"
        >
          Lihat Semua Laporan
        </Link>
      </div>

      <div className="flex flex-col gap-space-sm mb-6">
        {currentPeriodExpenses.length > 0 ? (
          currentPeriodExpenses.map(item => (
            <div
              key={item.id}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-start justify-between gap-space-sm hover:bg-surface-container-low/50 transition-colors border border-surface-container"
            >
              <div className="flex items-start gap-space-sm min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h5 className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                    {item.jenisAcara}
                  </h5>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {item.namaBarang} ({item.jumlah} {item.satuan} @ <span className="tabular-nums">{formatRupiah(item.hargaSatuan)}</span>)
                  </p>
                  <div className="flex items-center gap-space-xs mt-1">
                    <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container text-primary font-semibold">
                      {item.kategoriNama}
                    </span>
                    <span className="text-on-surface-variant text-[11px]">•</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {formatTanggal(item.tanggalTransaksi)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <span className="font-title-currency-md text-title-currency-md font-bold text-error tracking-tight tabular-nums">
                  - {formatRupiah(item.total)}
                </span>
                <span className="font-label-sm text-label-sm text-tertiary flex items-center gap-0.5 mt-0.5">
                  <span className="material-symbols-outlined text-[12px]">done_all</span>
                  Tersimpan
                </span>
              </div>
            </div>
          ))
        ) : (
          /* Empty state matching requirement Section M */
          <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center gap-3 border border-surface-container">
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[32px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <h4 className="font-headline-md text-headline-md font-bold text-on-surface">
                Belum Ada Transaksi
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[280px] mt-1">
                Belum ada transaksi pengeluaran yang tercatat pada periode {selectedPeriode}.
              </p>
            </div>
            <button
              onClick={() => openExpenseModal()}
              type="button"
              className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Mulai Catat Pengeluaran</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - Tersembunyi di Beranda lewat CSS karena tombol Catat Pengeluaran utama sudah tersedia */}
      <div
        className="fixed right-4 z-40 max-w-[480px] pointer-events-none justify-end no-print hidden"
        style={{ bottom: 'calc(64px + 16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-auto flex items-center gap-2 group">
          <span className="bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm px-3 py-1.5 rounded-full shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
            Catat Pengeluaran
          </span>
          <button
            onClick={() => openExpenseModal()}
            aria-label="Catat Pengeluaran Baru"
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary-container text-on-primary shadow-xl shadow-primary/25 flex items-center justify-center active:scale-95 transition-all"
            type="button"
          >
            <span
              className="material-symbols-outlined text-[30px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              add
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
