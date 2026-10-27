'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { SubsidiItem } from '@/lib/types';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function SubsidiPage() {
  const {
    subsidi,
    kategori,
    periode,
    selectedPeriode,
    setSelectedPeriode,
    openSubsidyModal,
    refreshData,
    showToast,
    summary,
    syncStatus,
    deleteRecord,
  } = useApp();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subsidyToDelete, setSubsidyToDelete] = useState<SubsidiItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Revalidasi data otomatis saat halaman Subsidi dibuka di perangkat manapun
  React.useEffect(() => {
    refreshData().catch(() => {});
  }, [refreshData]);

  // Filter riwayat subsidi untuk periode aktif
  const currentPeriodSubsidies = subsidi.filter(s => {
    if (!selectedPeriode || selectedPeriode === 'Semua' || selectedPeriode === 'Semua Periode') return true;
    const label = `${s.bulanHijriah || ''} ${s.tahunHijriah || ''} H`.trim().toLowerCase();
    const targetPeriod = (selectedPeriode || '').trim().toLowerCase();
    return label === targetPeriod || (s.periodeId || '').trim().toLowerCase() === targetPeriod;
  });

  const handleDeleteClick = (item: SubsidiItem) => {
    setSubsidyToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!subsidyToDelete) return;
    setDeleting(true);
    const targetId = String(subsidyToDelete.id || '').trim();

    try {
      await deleteRecord('subsidi', targetId);
      showToast('Catatan subsidi berhasil dihapus', 'Saldo kas telah disesuaikan');
      setDeleteModalOpen(false);
      setSubsidyToDelete(null);
    } catch (err: any) {
      showToast('Gagal menghapus subsidi', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* 1. Header Pengelolaan & Status Sinkronisasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-surface-variant">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              Pengelolaan Subsidi Kas
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/8 text-primary border border-primary/15">
              MMD Pesantren
            </span>
          </div>
          <p className="text-xs text-on-surface-variant font-medium mt-1">
            Alokasi plafon dan distribusi dana kas organisasi periode{' '}
            <strong className="text-primary font-bold">{selectedPeriode}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            className="h-10 px-3 bg-surface-container/60 rounded-xl border border-surface-variant text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={selectedPeriode}
            onChange={e => setSelectedPeriode(e.target.value)}
            aria-label="Pilih Periode Subsidi"
          >
            {periode.map(p => (
              <option key={p.id} value={p.labelPeriode}>
                {p.labelPeriode}
              </option>
            ))}
          </select>

          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
              syncStatus?.connected
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus?.connected ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            />
            <span className="hidden sm:inline">
              {syncStatus?.connected ? 'Tersinkron' : 'Lokal'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Kartu Alokasi Subsidi Tiap Lajnah (Responsive Grid) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
            Plafon Subsidi Tiap Lajnah
          </span>
          <span className="text-xs text-on-surface-variant font-medium">
            {summary?.categories?.length || 0} Divisi Aktif
          </span>
        </div>

        {summary?.categories && summary.categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant flex flex-col justify-between hover:border-primary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary font-bold flex-shrink-0">
                          <span className="material-symbols-outlined text-[22px]">
                            account_balance
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-sm sm:text-base font-bold text-on-surface truncate">
                            {cat.kategoriNama}
                          </h2>
                          <span className="text-xs text-on-surface-variant font-medium">
                            Plafon Masuk: <strong className="text-primary tabular-nums">{formatRupiah(cat.totalSubsidi)}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/8 text-primary hover:bg-primary/15 text-xs font-semibold active:scale-95 transition-all flex-shrink-0 border border-primary/15"
                        onClick={() => openSubsidyModal({ kategoriNama: cat.kategoriNama } as any)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[15px]">add</span>
                        <span>Tambah</span>
                      </button>
                    </div>

                    {/* Progress Bar Penggunaan Subsidi */}
                    <div className="space-y-1.5 mb-2">
                      <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden flex">
                        <div
                          className={`${barColor} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-on-surface-variant">
                          Terpakai: <strong className="text-rose-700 tabular-nums">{formatRupiah(cat.totalPengeluaran)}</strong> ({pct}%)
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            cat.saldoTersisa < 0 ? 'text-rose-700' : 'text-primary'
                          }`}
                        >
                          Sisa {formatRupiah(cat.saldoTersisa)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center text-on-surface-variant text-sm border border-surface-variant">
            Belum ada kategori aktif untuk periode ini.
          </div>
        )}
      </div>

      {/* 3. Tombol Utama Tambah Subsidi */}
      <button
        className="w-full h-12 bg-primary hover:bg-primary-container text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
        onClick={() => openSubsidyModal()}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">add_circle</span>
        <span>+ Tambah Subsidi / Alokasi Dana Kas</span>
      </button>

      {/* 4. Riwayat Penambahan Subsidi */}
      <div className="flex flex-col space-y-3 pb-8">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-base sm:text-lg font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[19px] text-primary">history</span>
              Riwayat Penambahan Subsidi ({currentPeriodSubsidies.length})
            </span>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">
            Periode {selectedPeriode}
          </span>
        </div>

        {currentPeriodSubsidies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentPeriodSubsidies.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-3.5 shadow-xs border border-surface-variant flex items-center justify-between gap-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface text-sm truncate">{item.kategoriNama}</span>
                    <span className="text-xs text-on-surface-variant tabular-nums">
                      • {formatTanggal(item.tanggalTransaksi)}
                    </span>
                  </div>
                  {item.catatan && (
                    <p className="text-xs text-on-surface-variant italic truncate mt-0.5">
                      {item.catatan}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-sm sm:text-base font-bold text-emerald-700 tabular-nums">
                      + {formatRupiah(item.nominal)}
                    </span>
                    {item.syncStatus === 'synced' ? (
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">done_all</span>
                        Tersinkron
                      </span>
                    ) : item.syncStatus === 'pending' ? (
                      <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        Menunggu
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">error</span>
                        Gagal
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openSubsidyModal(item)}
                      className="w-8 h-8 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high flex items-center justify-center active:scale-95 transition-colors"
                      title="Edit Subsidi"
                      aria-label="Edit Subsidi"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(item)}
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center active:scale-95 transition-colors border border-rose-200/50"
                      title="Hapus Subsidi"
                      aria-label="Hapus Subsidi"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center text-on-surface-variant text-xs sm:text-sm border border-surface-variant">
            Belum ada catatan penambahan subsidi pada periode ini. Klik tombol di atas untuk menambahkan subsidi kas baru.
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Hapus Catatan Subsidi?"
        message={`Apakah Anda yakin ingin menghapus alokasi subsidi untuk ${subsidyToDelete?.kategoriNama} sebesar ${formatRupiah(
          subsidyToDelete?.nominal
        )}? Saldo kas akan berkurang dan dihitung ulang.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSubsidyToDelete(null);
        }}
        loading={deleting}
      />
    </div>
  );
}
