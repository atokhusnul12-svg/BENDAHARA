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
  } = useApp();

  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);

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
  const persentasePenggunaan = summary?.persentasePenggunaan || 0;

  return (
    <div className="flex flex-col w-full relative">
      {/* Section 1: Header Meta, Periode Selector & Actual Sync Status */}
      <div className="flex flex-col gap-space-sm mb-space-md pt-2">
        <div className="flex items-center justify-between gap-space-sm">
          {/* Periode Dropdown Trigger */}
          <div className="relative">
            <button
              className="flex items-center gap-space-xs px-3 py-1.5 bg-surface-container-lowest rounded-full shadow-sm hover:bg-surface-container-low transition-colors text-on-surface border border-surface-container"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm flex-shrink-0 text-xs font-semibold ${
              syncStatus?.connected
                ? 'bg-tertiary-fixed/40 text-tertiary'
                : 'bg-amber-100 text-amber-800'
            }`}
            title={syncStatus?.error || 'Status sinkronisasi server'}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {syncStatus?.connected ? 'sync' : 'cloud_off'}
            </span>
            <span className="font-label-sm text-label-sm truncate max-w-[120px]">
              {syncStatus?.connected ? 'Sinkron Sheets' : 'Lokal (Belum Sync)'}
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: 'Ringkasan Total' Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-lg shadow-primary/10 p-5 mb-space-lg">
        {/* Subtle 8-Point Islamic Star / Hexagon Watermark Micro Pattern */}
        <div className="absolute -right-6 -bottom-6 w-36 h-36 opacity-10 pointer-events-none text-secondary-fixed">
          <svg aria-hidden="true" className="w-full h-full fill-current" viewBox="0 0 100 100">
            <polygon points="50,0 65,35 100,50 65,65 50,100 35,65 0,50 35,35" />
            <polygon points="50,12 76,24 88,50 76,76 50,88 24,76 12,50 24,24" />
          </svg>
        </div>
        <div className="absolute -right-12 -top-12 w-28 h-28 opacity-10 pointer-events-none text-secondary-fixed">
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
            <span className="font-label-md text-label-md tracking-wider uppercase opacity-90 text-on-primary">
              Ringkasan Total Anggaran
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-container text-on-secondary-container font-bold">
            Amanah MMD
          </span>
        </div>

        {/* Sisa Subsidi Primary Display */}
        <div className="mb-4 relative z-10">
          <span className="font-label-sm text-label-sm opacity-80 block mb-0.5 text-on-primary">
            Sisa Dana Kas Tersedia
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-title-currency-lg text-title-currency-lg text-on-primary tracking-tight">
              {formatRupiah(saldoTersisa)}
            </span>
            <span className="font-label-sm text-label-sm text-secondary-fixed font-semibold">
              {saldoTersisa >= 0 ? 'Tersedia' : 'Defisit'}
            </span>
          </div>
        </div>

        {/* Overall Linear Progress Bar */}
        <div className="relative z-10 mb-4 bg-primary/40 rounded-full h-2 p-0.5 overflow-hidden">
          <div
            className="bg-secondary-fixed h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, persentasePenggunaan))}%` }}
          />
        </div>

        {/* Stats Breakdown (Total Subsidi vs Total Pengeluaran) */}
        <div className="grid grid-cols-2 gap-space-sm pt-3 bg-black/10 rounded-xl px-3 py-2.5 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 opacity-75">
              <span className="material-symbols-outlined text-[14px]">account_balance</span>
              <span className="font-label-sm text-label-sm">Total Subsidi</span>
            </div>
            <span className="font-headline-md text-headline-md font-bold mt-0.5 text-on-primary">
              {formatRupiah(totalSubsidi)}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1 opacity-75">
              <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
              <span className="font-label-sm text-label-sm">
                Pengeluaran ({persentasePenggunaan}%)
              </span>
            </div>
            <span className="font-headline-md text-headline-md font-bold mt-0.5 text-secondary-fixed">
              {formatRupiah(totalPengeluaran)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-space-sm mb-space-lg">
        <button
          onClick={() => openExpenseModal()}
          className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all hover:bg-primary-container"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Catat Pengeluaran</span>
        </button>
        <button
          onClick={() => openSubsidyModal()}
          className="h-11 rounded-xl bg-surface-container text-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-surface-container-high border border-surface-container-high"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
          <span>+ Tambah Subsidi</span>
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
                    <span className="font-title-currency-md text-title-currency-md font-bold text-primary">
                      {formatRupiah(cat.saldoTersisa)}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant">
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
                      Terpakai: <strong className="text-error">{formatRupiah(cat.totalPengeluaran)}</strong>
                    </span>
                    <span className="font-semibold">{pct}% realisasi</span>
                  </div>
                </div>

                {/* Tombol Aksi Cepat Kategori */}
                <div className="flex items-center gap-2 pt-1 border-t border-surface-container mt-0.5">
                  <button
                    type="button"
                    onClick={() => openExpenseModal({ kategoriNama: cat.kategoriNama } as any)}
                    className="flex-1 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    <span>Catat Pengeluaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubsidyModal({ kategoriNama: cat.kategoriNama } as any)}
                    className="h-8 px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">volunteer_activism</span>
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
                    {item.namaBarang} ({item.jumlah} {item.satuan} @ {formatRupiah(item.hargaSatuan)})
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
                <span className="font-title-currency-md text-title-currency-md font-bold text-error tracking-tight">
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

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-20 right-4 z-40 max-w-[480px] pointer-events-none flex justify-end no-print">
        <div className="pointer-events-auto flex items-center gap-2 group">
          <span className="bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm px-3 py-1.5 rounded-full shadow-lg opacity-90 group-hover:opacity-100 transition-opacity">
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
