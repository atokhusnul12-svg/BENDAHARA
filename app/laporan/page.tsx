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

  // Revalidasi data otomatis saat halaman Laporan dibuka di perangkat manapun
  React.useEffect(() => {
    refreshData().catch(() => {});
  }, [refreshData]);

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
    <div className="flex flex-col w-full space-y-5">
      {/* Printable Header Section (Khusus Cetak Kertas/PDF) */}
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

      {/* 1. Category Switcher Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 no-print">
        <button
          onClick={() => setActiveKategori('Semua')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeKategori === 'Semua'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-on-surface-variant hover:bg-surface-container border border-surface-variant'
          }`}
          type="button"
        >
          <span>Semua Divisi</span>
        </button>

        {kategori.map(k => {
          const isActive = activeKategori === k.namaKategori;
          return (
            <button
              key={k.id}
              onClick={() => setActiveKategori(k.namaKategori)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-on-surface-variant hover:bg-surface-container border border-surface-variant'
              }`}
              type="button"
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#B69A5C]"></span>
              )}
              <span>{k.namaKategori}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Header Laporan & Tindakan Ekspor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-surface-variant no-print">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface tracking-tight truncate">
              Laporan Realisasi Kas
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/8 text-primary uppercase tracking-wide border border-primary/15">
              {activeKategori === 'Semua' ? 'Seluruh Divisi' : activeKategori}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium mt-1">
            <span className="material-symbols-outlined text-[16px] text-primary">
              calendar_month
            </span>
            <span>{selectedPeriode}</span>
            <span>•</span>
            <span>{filteredList.length} Transaksi Tercatat</span>
          </div>
        </div>

        {/* Tindakan Ekspor Responsif */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadExcel}
            className="flex-1 sm:flex-initial h-9 px-3 rounded-xl bg-white hover:bg-surface-container text-on-surface text-xs font-semibold active:scale-95 transition-all border border-surface-variant flex items-center justify-center gap-1.5 shadow-2xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-emerald-700">table_view</span>
            <span>Unduh Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial h-9 px-3 rounded-xl bg-white hover:bg-surface-container text-on-surface text-xs font-semibold active:scale-95 transition-all border border-surface-variant flex items-center justify-center gap-1.5 shadow-2xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-on-surface-variant">print</span>
            <span>Cetak PDF</span>
          </button>

          <button
            onClick={handleOpenGoogleSheets}
            className="flex-1 sm:flex-initial h-9 px-3 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">open_in_new</span>
            <span>Buka Sheets</span>
          </button>
        </div>
      </div>

      {/* 3. Kartu Ringkasan Plafon Kas */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[19px] text-primary">
              account_balance
            </span>
            <span className="text-xs sm:text-sm font-bold text-on-surface">
              Ringkasan Plafon Anggaran ({activeKategori})
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/8 text-primary text-xs font-bold border border-primary/15">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Realisasi {categorySummary.persentasePenggunaan}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3">
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-variant font-medium">Alokasi Plafon</span>
            <span className="text-sm sm:text-base font-bold text-on-surface tabular-nums mt-0.5 truncate">
              {formatRupiah(categorySummary.totalSubsidi)}
            </span>
          </div>
          <div className="flex flex-col border-l border-surface-container pl-3">
            <span className="text-[11px] text-on-surface-variant font-medium">Realisasi Belanja</span>
            <span className="text-sm sm:text-base font-bold text-rose-700 tabular-nums mt-0.5 truncate">
              {formatRupiah(categorySummary.totalPengeluaran)}
            </span>
          </div>
          <div className="flex flex-col border-l border-surface-container pl-3">
            <span className="text-[11px] text-on-surface-variant font-medium">Sisa Kas</span>
            <span className="text-sm sm:text-base font-bold text-primary tabular-nums mt-0.5 truncate">
              {formatRupiah(categorySummary.saldoTersisa)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Baris Pencarian & Tombol Catat */}
      <div className="flex items-center gap-2.5 no-print">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Cari transaksi, kegiatan, atau rincian belanja..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white text-on-surface text-xs sm:text-sm border border-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium shadow-xs"
          />
        </div>

        <button
          onClick={() => openExpenseModal()}
          className="h-11 px-4 bg-primary hover:bg-primary-container text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[19px]">add_circle</span>
          <span className="hidden xs:inline">Catat Pengeluaran</span>
          <span className="xs:hidden">Catat</span>
        </button>
      </div>

      {/* 5. Tampilan Data: Tabel Desktop & Kartu Mobile */}
      <div className="flex flex-col space-y-2 pb-10">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Daftar Rincian Belanja ({filteredList.length})
          </span>
          <span className="text-xs font-bold text-primary tabular-nums">
            Total Pengeluaran: {formatRupiah(totalFilteredExpense)}
          </span>
        </div>

        {filteredList.length > 0 ? (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-surface-variant overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container/60 border-b border-surface-variant text-on-surface-variant font-semibold">
                    <th className="py-3 px-3.5">Tanggal</th>
                    <th className="py-3 px-3.5">Kategori & Acara</th>
                    <th className="py-3 px-3.5">Rincian Barang</th>
                    <th className="py-3 px-3.5 text-center">Qty</th>
                    <th className="py-3 px-3.5 text-right">Harga Satuan</th>
                    <th className="py-3 px-3.5 text-right">Subtotal</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-center no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {filteredList.map(item => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-container/40 transition-colors group"
                    >
                      <td className="py-3 px-3.5 text-on-surface-variant whitespace-nowrap tabular-nums">
                        {formatTanggal(item.tanggalTransaksi)}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{item.jenisAcara}</span>
                          <span className="text-[11px] text-primary font-medium">{item.kategoriNama}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{item.namaBarang}</span>
                          {item.catatan && (
                            <span className="text-[11px] text-on-surface-variant italic">
                              Catatan: {item.catatan}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold tabular-nums">
                          {item.jumlah} {item.satuan}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-on-surface-variant">
                        {formatRupiah(item.hargaSatuan)}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums font-bold text-rose-700">
                        {formatRupiah(item.total)}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {item.syncStatus === 'synced' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <span className="material-symbols-outlined text-[13px]">done_all</span>
                            Tersinkron
                          </span>
                        ) : item.syncStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            Menunggu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold">
                            <span className="material-symbols-outlined text-[13px]">error</span>
                            Gagal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openExpenseModal(item)}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            title="Edit Transaksi"
                            aria-label="Edit Transaksi"
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(item)}
                            className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Hapus Transaksi"
                            aria-label="Hapus Transaksi"
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="block md:hidden space-y-2.5">
              {filteredList.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-3.5 shadow-xs border border-surface-variant flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/8 text-primary">
                          {item.kategoriNama}
                        </span>
                        <span className="text-xs text-on-surface-variant tabular-nums">
                          {formatTanggal(item.tanggalTransaksi)}
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-on-surface mt-1 truncate">
                        {item.jenisAcara}
                      </h5>
                      <p className="text-xs text-on-surface font-medium mt-0.5">
                        {item.namaBarang}
                      </p>
                      <p className="text-[11px] text-on-surface-variant tabular-nums mt-0.5">
                        {item.jumlah} {item.satuan} × {formatRupiah(item.hargaSatuan)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-sm font-bold text-rose-700 tabular-nums">
                        {formatRupiah(item.total)}
                      </span>
                      {item.syncStatus === 'synced' ? (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 mt-1">
                          <span className="material-symbols-outlined text-[12px]">done_all</span>
                          Tersinkron
                        </span>
                      ) : item.syncStatus === 'pending' ? (
                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5 mt-1">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          Menunggu
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-700 font-semibold flex items-center gap-0.5 mt-1">
                          <span className="material-symbols-outlined text-[12px]">error</span>
                          Gagal
                        </span>
                      )}
                    </div>
                  </div>

                  {item.catatan && (
                    <p className="text-xs text-on-surface-variant bg-surface-container/60 p-2 rounded-lg italic">
                      Catatan: {item.catatan}
                    </p>
                  )}

                  {/* Tombol Aksi Edit & Hapus */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container no-print">
                    <button
                      type="button"
                      onClick={() => openExpenseModal(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-xs font-semibold active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold active:scale-95 transition-all border border-rose-200/50"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2 border border-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant opacity-60">
              receipt_long
            </span>
            <p className="text-sm font-bold text-on-surface">
              Tidak Ada Transaksi Ditemukan
            </p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Tidak ada data pengeluaran yang cocok dengan filter atau kata kunci pencarian.
            </p>
          </div>
        )}
      </div>

      {/* Printable Signature Section (Khusus Cetak) */}
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
