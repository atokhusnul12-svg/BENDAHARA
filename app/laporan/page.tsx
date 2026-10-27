'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { PengeluaranItem } from '@/lib/types';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function LaporanPage() {
  const {
    pengeluaran,
    kategori,
    periode,
    selectedPeriode,
    setSelectedPeriode,
    openExpenseModal,
    refreshData,
    showToast,
    summary,
    deleteRecord,
  } = useApp();

  const [activeKategori, setActiveKategori] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PengeluaranItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter pengeluaran berdasarkan periode, kategori, dan search query
  const filteredList = pengeluaran.filter(item => {
    const isAllPeriods = !selectedPeriode || selectedPeriode === 'Semua' || selectedPeriode === 'Semua Periode';
    const label = `${item.bulanHijriah || ''} ${item.tahunHijriah || ''} H`.trim().toLowerCase();
    const targetPeriod = (selectedPeriode || '').trim().toLowerCase();
    const matchPeriod = isAllPeriods || label === targetPeriod || (item.periodeId || '').trim().toLowerCase() === targetPeriod;

    const itemKat = (item.kategoriNama || '').toLowerCase().trim();
    const actKat = activeKategori.toLowerCase().trim();
    const matchKat =
      activeKategori === 'Semua' ||
      itemKat === actKat ||
      item.kategoriId === activeKategori ||
      (itemKat.length > 2 && actKat.includes(itemKat)) ||
      (actKat.length > 2 && itemKat.includes(actKat));

    const query = searchQuery.toLowerCase();
    const matchSearch =
      !query ||
      item.jenisAcara.toLowerCase().includes(query) ||
      item.namaBarang.toLowerCase().includes(query) ||
      (item.catatan || '').toLowerCase().includes(query);

    return matchPeriod && matchKat && matchSearch;
  });

  const totalFilteredExpense = filteredList.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  // Ambil metrik untuk kategori aktif (atau total periode jika 'Semua')
  const categorySummary =
    activeKategori === 'Semua'
      ? {
          totalSubsidi: summary?.totalSubsidi || 0,
          totalPengeluaran: summary?.totalPengeluaran || 0,
          saldoTersisa: summary?.saldoTersisa || 0,
          persentasePenggunaan: summary?.persentasePenggunaan || 0,
        }
      : summary?.categories?.find(c => {
          const cKat = c.kategoriNama.toLowerCase().trim();
          const actKat = activeKategori.toLowerCase().trim();
          return cKat === actKat || (cKat.length > 2 && actKat.includes(cKat)) || (actKat.length > 2 && cKat.includes(actKat));
        }) || {
          totalSubsidi: 0,
          totalPengeluaran: 0,
          saldoTersisa: 0,
          persentasePenggunaan: 0,
        };

  const handleDeleteClick = (item: PengeluaranItem) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    const targetId = String(itemToDelete.id || '').trim();

    try {
      await deleteRecord('pengeluaran', targetId);
      showToast('Transaksi berhasil dihapus', 'Saldo kas telah dihitung ulang');
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      showToast('Gagal menghapus transaksi', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadExcel = () => {
    const url = `/api/export?format=xlsx&periode=${encodeURIComponent(
      selectedPeriode
    )}&kategori=${encodeURIComponent(activeKategori)}`;
    window.open(url, '_blank');
  };

  const handleOpenGoogleSheets = () => {
    const sheetsUrl =
      process.env.NEXT_PUBLIC_SPREADSHEET_URL ||
      'https://docs.google.com/spreadsheets/d/1PAqCW-KV52-5X5GUn61tAhYst3kOd5TvJuHnRTQvfig/edit';
    window.open(sheetsUrl, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col w-full space-y-space-md pt-2">
      {/* Printable Header Section (Only visible when printing) */}
      <div className="print-only text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider">
          Laporan Keuangan & Realisasi Belanja
        </h1>
        <h2 className="text-base font-semibold">Majelis Musyawarah & Dirosah (MMD)</h2>
        <p className="text-sm mt-1">
          Periode: <strong>{selectedPeriode}</strong> • Kategori: <strong>{activeKategori}</strong>
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Dicetak pada: {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
        </p>
      </div>

      {/* Category Switcher Tabs (Scrollable pill row) */}
      <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1 no-print">
        <button
          onClick={() => setActiveKategori('Semua')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all flex items-center gap-1.5 ${
            activeKategori === 'Semua'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
          type="button"
        >
          Semua Divisi
        </button>

        {kategori.map(k => {
          const isActive = activeKategori === k.namaKategori;
          return (
            <button
              key={k.id}
              onClick={() => setActiveKategori(k.namaKategori)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
              type="button"
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container"></span>
              )}
              {k.namaKategori}
            </button>
          );
        })}
      </div>

      {/* Header & Export Actions Row */}
      <div className="flex flex-col gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06)] border border-surface-container no-print">
        <div className="flex items-start justify-between">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight truncate">
                Laporan Pengeluaran
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                {activeKategori === 'Semua' ? 'MMD' : activeKategori}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mt-0.5">
              <span className="material-symbols-outlined text-[16px] text-primary">
                calendar_today
              </span>
              <span>{selectedPeriode}</span>
              <span className="text-outline-variant">•</span>
              <span>{filteredList.length} Transaksi</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
        </div>

        {/* Quick Action Export Buttons */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-space-xs">
          <button
            onClick={handleDownloadExcel}
            className="flex items-center justify-center gap-1 py-2 px-1.5 sm:px-2 rounded-lg bg-surface-container-low text-primary text-[11px] sm:text-label-sm font-semibold active:scale-95 transition-transform hover:bg-surface-container border border-surface-container min-w-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] flex-shrink-0">table_view</span>
            <span className="truncate">Unduh Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1 py-2 px-1.5 sm:px-2 rounded-lg bg-surface-container-low text-on-surface text-[11px] sm:text-label-sm font-semibold active:scale-95 transition-transform hover:bg-surface-container border border-surface-container min-w-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] flex-shrink-0">print</span>
            <span className="truncate">Cetak PDF</span>
          </button>
          <button
            onClick={handleOpenGoogleSheets}
            className="flex items-center justify-center gap-1 py-2 px-1.5 sm:px-2 rounded-lg bg-primary-container text-on-primary text-[11px] sm:text-label-sm font-semibold shadow-sm active:scale-95 transition-transform hover:bg-primary min-w-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] flex-shrink-0">open_in_new</span>
            <span className="truncate">Buka Sheets</span>
          </button>
        </div>
      </div>

      {/* 3-Metric Fiscal Card (Plafon Subsidi vs Realisasi) */}
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-md shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06)] border border-surface-container">
        <div className="flex items-center justify-between pb-3">
          <span className="font-label-md text-label-md font-semibold text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-secondary">
              account_balance
            </span>
            Plafon Subsidi Kas ({activeKategori})
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            Realisasi {categorySummary.persentasePenggunaan}%
          </span>
        </div>

        {/* 3 Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 py-2 bg-surface-container-low rounded-lg p-2.5">
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-variant font-medium">Alokasi</span>
            <span className="font-headline-md text-[13px] font-bold text-on-surface truncate">
              {formatRupiah(categorySummary.totalSubsidi)}
            </span>
          </div>
          <div className="flex flex-col border-l border-surface-dim pl-2">
            <span className="text-[11px] text-on-surface-variant font-medium">Terpakai</span>
            <span className="font-headline-md text-[13px] font-bold text-error truncate">
              {formatRupiah(categorySummary.totalPengeluaran)}
            </span>
          </div>
          <div className="flex flex-col border-l border-surface-dim pl-2">
            <span className="text-[11px] text-on-surface-variant font-medium">Sisa Kas</span>
            <span className="font-headline-md text-[13px] font-bold text-primary truncate">
              {formatRupiah(categorySummary.saldoTersisa)}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2 no-print">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Cari transaksi / rincian barang..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-sm border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={() => openExpenseModal()}
          className="h-11 px-3 bg-primary text-on-primary rounded-xl font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-sm active:scale-95 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Catat</span>
        </button>
      </div>

      {/* Transaction List */}
      <div className="flex flex-col gap-space-sm pb-10">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Daftar Rincian Belanja ({filteredList.length})
          </span>
          <span className="text-xs font-bold text-primary">
            Total: {formatRupiah(totalFilteredExpense)}
          </span>
        </div>

        {filteredList.length > 0 ? (
          filteredList.map(item => (
            <div
              key={item.id}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2 border border-surface-container hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-label-lg text-label-lg font-bold text-on-surface">
                      {item.jenisAcara}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      {item.kategoriNama}
                    </span>
                  </div>
                  <p className="font-body-md text-sm text-on-surface font-medium mt-0.5">
                    {item.namaBarang}
                  </p>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    {item.jumlah} {item.satuan} × {formatRupiah(item.hargaSatuan)}
                  </p>
                </div>

                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="font-title-currency-md text-title-currency-md font-bold text-error">
                    {formatRupiah(item.total)}
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-0.5">
                    {formatTanggal(item.tanggalTransaksi)}
                  </span>
                  {item.syncStatus === 'synced' ? (
                    <span className="font-label-sm text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 mt-1">
                      <span className="material-symbols-outlined text-[12px]">done_all</span>
                      Tersinkron
                    </span>
                  ) : item.syncStatus === 'pending' ? (
                    <span className="font-label-sm text-[10px] text-amber-700 font-semibold flex items-center gap-0.5 mt-1">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      Menunggu Sinkron
                    </span>
                  ) : (
                    <span className="font-label-sm text-[10px] text-rose-700 font-semibold flex items-center gap-0.5 mt-1">
                      <span className="material-symbols-outlined text-[12px]">error</span>
                      Gagal Sinkron
                    </span>
                  )}
                </div>
              </div>

              {item.catatan && (
                <p className="text-xs text-on-surface-variant bg-surface-container-low p-2 rounded-lg italic">
                  Catatan: {item.catatan}
                </p>
              )}

              {/* Action buttons (Edit & Delete) */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container/60 no-print">
                <button
                  type="button"
                  onClick={() => openExpenseModal(item)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(item)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error-container/30 text-error hover:bg-error-container/60 text-xs font-semibold active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center gap-2 border border-surface-container">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant opacity-60">
              receipt_long
            </span>
            <p className="font-label-md text-label-md font-bold text-on-surface">
              Tidak Ada Transaksi Ditemukan
            </p>
            <p className="text-xs text-on-surface-variant max-w-[260px]">
              Tidak ada data pengeluaran yang cocok dengan filter atau kata kunci pencarian.
            </p>
          </div>
        )}
      </div>

      {/* Printable Signature Section (Only visible when printing) */}
      <div className="print-only pt-10 grid grid-cols-2 text-center text-sm">
        <div className="flex flex-col items-center">
          <p>Mengetahui,</p>
          <p className="font-bold">Ketua Majelis MMD</p>
          <div className="h-16"></div>
          <p className="border-b border-black w-40"></p>
        </div>
        <div className="flex flex-col items-center">
          <p>Pondok Pesantren MMD,</p>
          <p className="font-bold">Bendahara Kas</p>
          <div className="h-16"></div>
          <p className="border-b border-black w-40"></p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Hapus Transaksi Pengeluaran?"
        message={`Apakah Anda yakin ingin menghapus catatan belanja "${itemToDelete?.namaBarang}" (${formatRupiah(
          itemToDelete?.total
        )})? Data akan dihapus dari Google Sheets dan saldo kas akan dihitung ulang.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        loading={deleting}
      />
    </div>
  );
}
