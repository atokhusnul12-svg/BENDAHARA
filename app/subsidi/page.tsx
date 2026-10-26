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
  } = useApp();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subsidyToDelete, setSubsidyToDelete] = useState<SubsidiItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const res = await fetch(`/api/subsidi?id=${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menghapus subsidi.');

      await refreshData();
      showToast('Catatan subsidi berhasil dihapus', 'Saldo kas telah disesuaikan');
      setDeleteModalOpen(false);
      setSubsidyToDelete(null);
    } catch (err: any) {
      console.error('[Hapus Subsidi Error]:', err);
      showToast('Gagal menghapus subsidi', err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-5 pt-2">
      {/* Header & Sync Status Badge */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
            Kelola Subsidi
          </span>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-sm ${
              syncStatus?.connected
                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  syncStatus?.connected ? 'bg-tertiary-container' : 'bg-amber-500'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus?.connected ? 'bg-tertiary' : 'bg-amber-600'
                }`}
              ></span>
            </span>
            <span className="material-symbols-outlined text-[14px]">
              {syncStatus?.connected ? 'check_circle' : 'cloud_off'}
            </span>
            <span className="font-label-sm text-label-sm font-semibold">
              {syncStatus?.connected ? 'Tersinkron GSheets' : 'Mode Lokal'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Alokasi dana kas organisasi periode{' '}
            <strong className="text-primary font-semibold">{selectedPeriode}</strong>
          </p>

          <select
            className="text-xs bg-surface-container-low px-2 py-1 rounded-lg border border-surface-container font-semibold text-primary focus:outline-none"
            value={selectedPeriode}
            onChange={e => setSelectedPeriode(e.target.value)}
          >
            {periode.map(p => (
              <option key={p.id} value={p.labelPeriode}>
                {p.labelPeriode}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Subsidy Cards */}
      <div className="space-y-3">
        {summary?.categories && summary.categories.length > 0 ? (
          summary.categories.map(cat => {
            const pct = cat.persentasePenggunaan;
            const barColor =
              pct > 90
                ? 'bg-error'
                : pct > 75
                ? 'bg-secondary-container'
                : 'bg-primary';

            return (
              <div
                key={cat.kategoriId}
                className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06),0_2px_6px_-1px_rgba(0,0,0,0.04)] border border-surface-container transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        account_balance
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-label-lg text-label-lg text-on-surface font-bold truncate">
                        {cat.kategoriNama}
                      </h2>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Total Subsidi: <strong>{formatRupiah(cat.totalSubsidi)}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-label-sm text-label-sm active:scale-95 transition-transform flex-shrink-0 font-semibold"
                    onClick={() => openSubsidyModal({ kategoriNama: cat.kategoriNama } as any)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Tambah</span>
                  </button>
                </div>

                {/* Progress / Usage Bar */}
                <div className="space-y-1.5 mt-3">
                  <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden flex">
                    <div
                      className={`${barColor} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between font-label-sm text-label-sm">
                    <span className="text-on-surface-variant">
                      Terpakai: <strong className="text-error font-medium">{formatRupiah(cat.totalPengeluaran)}</strong> ({pct}%)
                    </span>
                    <span
                      className={`font-semibold ${
                        cat.saldoTersisa < 0 ? 'text-error' : 'text-tertiary'
                      }`}
                    >
                      Sisa {formatRupiah(cat.saldoTersisa)}
                    </span>
                  </div>
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

      {/* Primary Trigger Button */}
      <button
        className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all hover:bg-primary-container"
        onClick={() => openSubsidyModal()}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">add_circle</span>
        <span>+ Tambah Subsidi / Alokasi Dana</span>
      </button>

      {/* Riwayat Penambahan Subsidi */}
      <div className="flex flex-col gap-space-sm pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="font-headline-md text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-primary">history</span>
            Riwayat Penambahan Subsidi ({currentPeriodSubsidies.length})
          </span>
          <span className="text-xs text-on-surface-variant font-medium">
            Periode {selectedPeriode}
          </span>
        </div>

        {currentPeriodSubsidies.length > 0 ? (
          currentPeriodSubsidies.map(item => (
            <div
              key={item.id}
              className="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-surface-container flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-on-surface text-sm">{item.kategoriNama}</span>
                  <span className="text-[11px] text-on-surface-variant">
                    • {formatTanggal(item.tanggalTransaksi)}
                  </span>
                </div>
                {item.catatan && (
                  <p className="text-xs text-on-surface-variant italic truncate mt-0.5">
                    {item.catatan}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-title-currency-md text-sm font-bold text-primary">
                  + {formatRupiah(item.nominal)}
                </span>
                <button
                  type="button"
                  onClick={() => openSubsidyModal(item)}
                  className="w-8 h-8 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container flex items-center justify-center active:scale-95"
                  title="Edit Subsidi"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(item)}
                  className="w-8 h-8 rounded-lg bg-error-container/30 text-error hover:bg-error-container/60 flex items-center justify-center active:scale-95"
                  title="Hapus Subsidi"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface-container-lowest rounded-xl p-6 text-center text-on-surface-variant text-xs border border-surface-container">
            Belum ada catatan subsidi pada periode ini. Klik tombol di atas untuk menambahkan subsidi kas.
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
