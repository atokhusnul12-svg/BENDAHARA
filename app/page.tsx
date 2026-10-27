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
    refreshData,
    openExpenseModal,
    openSubsidyModal,
  } = useApp();

  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Revalidasi data otomatis saat Dashboard dibuka
  React.useEffect(() => {
    refreshData().catch(() => {});
  }, [refreshData]);

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

  // Filter transaksi terbaru untuk periode aktif (maksimal 6 transaksi)
  const currentPeriodExpenses = pengeluaran
    .filter(p => {
      if (!selectedPeriode || selectedPeriode === 'Semua' || selectedPeriode === 'Semua Periode') return true;
      const label = `${p.bulanHijriah || ''} ${p.tahunHijriah || ''} H`.trim().toLowerCase();
      const target = selectedPeriode.trim().toLowerCase();
      return label === target || (p.periodeId || '').trim().toLowerCase() === target;
    })
    .slice(0, 6);

  const totalSubsidi = summary?.totalSubsidi || 0;
  const totalPengeluaran = summary?.totalPengeluaran || 0;
  const saldoTersisa = summary?.saldoTersisa || 0;
  const saldoTerkonfirmasi = summary?.saldoTerkonfirmasi ?? saldoTersisa;
  const persentasePenggunaan = summary?.persentasePenggunaan || 0;
  const hasPendingSync = Boolean(summary?.hasPendingSync);

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* 1. Header Pengendali: Pemilih Periode & Status Sinkronisasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          {/* Periode Dropdown Trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-2 px-3.5 py-2 min-h-[42px] bg-white rounded-xl shadow-xs hover:bg-surface-container-low transition-colors text-on-surface border border-surface-variant active:scale-[0.99] font-medium"
              onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
              type="button"
              aria-label="Pilih Periode Anggaran"
            >
              <span className="material-symbols-outlined text-[19px] text-primary">
                calendar_month
              </span>
              <span className="text-sm font-bold text-on-surface">
                {selectedPeriode || 'Pilih Periode'}
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {periodDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg z-30 py-1.5 flex flex-col border border-surface-variant animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold border-b border-surface-container">
                  Siklus Anggaran Hijriyah
                </div>
                <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
                  {periode.map(p => {
                    const isSelected = selectedPeriode === p.labelPeriode;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPeriode(p.labelPeriode);
                          setPeriodDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-on-surface hover:bg-surface-container'
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
                </div>
                <div className="h-px bg-surface-container my-0.5"></div>
                <Link
                  href="/pengaturan"
                  className="flex items-center gap-1.5 px-3 py-2 text-left text-xs text-primary hover:bg-primary/8 transition-colors font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>+ Kelola / Tambah Periode</span>
                </Link>
              </div>
            )}
          </div>

          <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">
            Tahun Anggaran MMD MIDA
          </span>
        </div>

        {/* Status Sinkronisasi Real-Time */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-semibold border ${
              syncStatus?.connected
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
            title={syncStatus?.error || 'Status koneksi Google Sheets'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus?.connected ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            />
            <span className="truncate max-w-[170px]">
              {syncStatus?.connected ? 'Tersinkron Google Sheets' : 'Mode Offline / Lokal'}
            </span>
          </div>

          <button
            onClick={() => refreshData().catch(() => {})}
            title="Muat ulang data dari server"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-surface-variant text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all active:scale-95 shadow-xs"
            type="button"
            aria-label="Refresh Data"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Card: Ringkasan Total Anggaran (Refined Islamic Elegance) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#10382D] to-[#174D3C] text-white shadow-md border border-[#174D3C]/60 p-5 sm:p-7">
        {/* Ornamen Islam Geometris 8-Titik Halus (Watermark Otentik) */}
        <div className="absolute -right-8 -bottom-8 w-44 h-44 opacity-[0.05] pointer-events-none text-[#B69A5C]">
          <svg aria-hidden="true" className="w-full h-full fill-current" viewBox="0 0 100 100">
            <polygon points="50,0 65,35 100,50 65,65 50,100 35,65 0,50 35,35" />
            <polygon points="50,12 76,24 88,50 76,76 50,88 24,76 12,50 24,24" />
          </svg>
        </div>
        <div className="absolute right-32 -top-12 w-32 h-32 opacity-[0.04] pointer-events-none text-[#B69A5C]">
          <svg aria-hidden="true" className="w-full h-full fill-current" viewBox="0 0 100 100">
            <polygon points="50,0 65,35 100,50 65,65 50,100 35,65 0,50 35,35" />
          </svg>
        </div>

        {/* Header Hero Card */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[19px] text-[#B69A5C]">
              account_balance_wallet
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-white/90">
              Ringkasan Kas Anggaran
            </span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#B69A5C]/20 border border-[#B69A5C]/40 text-[#E8D8B0]">
            Buku Kas Terpadu
          </span>
        </div>

        {/* Grid Informasi Keuangan Responsif: Saldo Utama & Metrik Pembukuan */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10 items-end">
          {/* Kolom Kiri (Desktop: 7 cols): Saldo Kas Tersedia */}
          <div className="lg:col-span-7 flex flex-col">
            <span className="text-xs text-white/80 font-medium mb-1">
              {hasPendingSync ? 'Saldo Sementara (Termasuk Pending)' : 'Sisa Dana Kas Tersedia'}
            </span>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-title-currency-lg text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white tabular-nums leading-none">
                {formatRupiah(saldoTersisa)}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  saldoTersisa >= 0
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                    : 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                }`}
              >
                {saldoTersisa >= 0 ? 'Surplus' : 'Defisit'}
              </span>
            </div>

            {hasPendingSync && (
              <p className="mt-2 text-xs text-amber-200/90 font-medium">
                Saldo Terkonfirmasi Google Sheets: <strong>{formatRupiah(saldoTerkonfirmasi)}</strong> ({summary?.pendingCount || 1} antrean)
              </p>
            )}

            {/* Linear Progress Realisasi */}
            <div className="mt-4">
              <div className="w-full bg-black/25 rounded-full h-2 p-0.5 overflow-hidden border border-white/10">
                <div
                  className="bg-[#B69A5C] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, persentasePenggunaan))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/80 font-medium mt-1.5">
                <span>Realisasi Kas Anggaran</span>
                <span className="tabular-nums font-semibold">{persentasePenggunaan}% Terpakai</span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan (Desktop: 5 cols): Alokasi Subsidi vs Total Pengeluaran */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-black/20 rounded-xl p-3.5 border border-white/10">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-white/75">
                <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
                <span className="text-xs font-medium">Total Subsidi</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-white mt-1 tabular-nums tracking-tight">
                {formatRupiah(totalSubsidi)}
              </span>
              <span className="text-[10px] text-white/60 mt-0.5">Plafon Masuk</span>
            </div>

            <div className="flex flex-col border-l border-white/15 pl-3">
              <div className="flex items-center gap-1.5 text-white/75">
                <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
                <span className="text-xs font-medium">Total Belanja</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-[#E8D8B0] mt-1 tabular-nums tracking-tight">
                {formatRupiah(totalPengeluaran)}
              </span>
              <span className="text-[10px] text-white/60 mt-0.5">Pengeluaran Riil</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tombol Aksi Cepat Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => openExpenseModal()}
          className="h-12 min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>Catat Transaksi Pengeluaran</span>
        </button>

        <button
          onClick={() => openSubsidyModal()}
          className="h-12 min-h-[48px] px-4 py-3 rounded-xl bg-white hover:bg-surface-container text-primary border border-surface-variant font-semibold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px] text-secondary">volunteer_activism</span>
          <span>Tambah Alokasi Subsidi</span>
        </button>
      </div>

      {/* 4. Section Alokasi Tiap Lajnah (Kategori Anggaran) */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
              Alokasi Anggaran Tiap Lajnah
            </span>
            <span className="text-xs px-2 py-0.5 bg-primary/8 text-primary rounded-full font-semibold border border-primary/15">
              {summary?.categories?.length || 0} Divisi
            </span>
          </div>
          <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">
            Status Realisasi per Kategori
          </span>
        </div>

        {summary?.categories && summary.categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {summary.categories.map(cat => {
              const pct = cat.persentasePenggunaan;
              const barColor =
                pct > 90
                  ? 'bg-rose-600'
                  : pct > 75
                  ? 'bg-amber-600'
                  : 'bg-primary';

              return (
                <div
                  key={cat.kategoriId}
                  className="bg-white rounded-xl p-4 shadow-xs border border-surface-variant flex flex-col justify-between hover:border-primary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold flex-shrink-0">
                          <span className="material-symbols-outlined text-[20px]">
                            account_balance
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-on-surface truncate">
                            {cat.kategoriNama}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {cat.jumlahTransaksi} Catatan Transaksi
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-bold text-primary tabular-nums">
                          {formatRupiah(cat.saldoTersisa)}
                        </span>
                        <span className="text-[11px] text-on-surface-variant tabular-nums">
                          Plafon: {formatRupiah(cat.totalSubsidi)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Kategori */}
                    <div className="space-y-1 mb-3">
                      <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`${barColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>
                          Terpakai: <strong className="text-on-surface tabular-nums">{formatRupiah(cat.totalPengeluaran)}</strong>
                        </span>
                        <span className="font-semibold tabular-nums">{pct}% Terpakai</span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Cepat Kategori */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container">
                    <button
                      type="button"
                      onClick={() => openExpenseModal({ kategoriNama: cat.kategoriNama } as any)}
                      className="h-9 px-2 rounded-lg bg-primary/8 hover:bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_circle</span>
                      <span>Catat Belanja</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openSubsidyModal({ kategoriNama: cat.kategoriNama } as any)}
                      className="h-9 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
                      <span>+ Subsidi</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 text-center text-on-surface-variant text-sm border border-surface-variant">
            Belum ada data kategori aktif untuk periode ini.
          </div>
        )}
      </div>

      {/* 5. Section Pengeluaran Terbaru */}
      <div className="flex flex-col space-y-3 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
              Pengeluaran Terbaru
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              (Periode {selectedPeriode})
            </span>
          </div>
          <Link
            href="/laporan"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5"
          >
            <span>Buka Seluruh Laporan</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </Link>
        </div>

        {currentPeriodExpenses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentPeriodExpenses.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-3.5 shadow-xs border border-surface-variant flex flex-col justify-between hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/8 text-primary w-fit mb-1 truncate">
                      {item.kategoriNama}
                    </span>
                    <h5 className="text-sm font-bold text-on-surface truncate">
                      {item.jenisAcara}
                    </h5>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">
                      {item.namaBarang} ({item.jumlah} {item.satuan})
                    </p>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-sm font-bold text-rose-700 tabular-nums">
                      - {formatRupiah(item.total)}
                    </span>
                    <span className="text-[11px] text-on-surface-variant tabular-nums mt-0.5">
                      {formatTanggal(item.tanggalTransaksi)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-surface-container mt-2 text-[11px]">
                  <span className="text-on-surface-variant font-medium">
                    @ {formatRupiah(item.hargaSatuan)}
                  </span>
                  {item.syncStatus === 'synced' ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">done_all</span>
                      Tersinkron
                    </span>
                  ) : item.syncStatus === 'pending' ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      Menunggu
                    </span>
                  ) : (
                    <span className="text-rose-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      Gagal
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 border border-surface-variant">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <h4 className="text-sm font-bold text-on-surface">
                Belum Ada Catatan Transaksi
              </h4>
              <p className="text-xs text-on-surface-variant max-w-xs mt-0.5">
                Belum ada transaksi pengeluaran pada periode {selectedPeriode}.
              </p>
            </div>
            <button
              onClick={() => openExpenseModal()}
              type="button"
              className="mt-1 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Catat Pengeluaran Pertama</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
