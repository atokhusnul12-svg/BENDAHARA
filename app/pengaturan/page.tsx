'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BULAN_HIJRIAH_LIST } from '@/lib/format';
import { KategoriItem, PeriodeItem } from '@/lib/types';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function PengaturanPage() {
  const {
    kategori,
    periode,
    syncStatus,
    refreshData,
    showToast,
    selectedPeriode,
    setSelectedPeriode,
  } = useApp();

  const [testingSync, setTestingSync] = useState(false);

  // Modal Kategori State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<KategoriItem | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryStatusInput, setCategoryStatusInput] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  // Modal / Form Tambah Periode State
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [selectedBulan, setSelectedBulan] = useState('Jumadal Akhir');
  const [selectedTahun, setSelectedTahun] = useState(1448);
  const [periodStatusAktif, setPeriodStatusAktif] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Delete Periode State
  const [deletePeriodModalOpen, setDeletePeriodModalOpen] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<PeriodeItem | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  // Delete Kategori State
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<KategoriItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Reset Data & Cache State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Modal Panduan Lengkap
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // 1. Test Connection Handler
  const handleTestConnection = async () => {
    setTestingSync(true);
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      await refreshData();
      if (json.data?.connected) {
        showToast('Koneksi Google Sheets Berhasil', 'Spreadsheet tersinkronisasi sempurna.');
      } else {
        showToast('Pemeriksaan Selesai', json.data?.error || 'Aplikasi dalam mode penyimpanan lokal.', 'info');
      }
    } catch (e: any) {
      showToast('Gagal memeriksa koneksi', e.message, 'error');
    } finally {
      setTestingSync(false);
    }
  };

  // 2. Kategori Handlers
  const openAddCategory = () => {
    setCategoryToEdit(null);
    setCategoryNameInput('');
    setCategoryStatusInput(true);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (kat: KategoriItem) => {
    setCategoryToEdit(kat);
    setCategoryNameInput(kat.namaKategori);
    setCategoryStatusInput(kat.statusAktif);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryNameInput.trim()) {
      showToast('Validasi Gagal', 'Nama kategori wajib diisi.', 'error');
      return;
    }

    setSavingCategory(true);
    try {
      if (categoryToEdit) {
        const res = await fetch('/api/kategori', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: categoryToEdit.id,
            namaKategori: categoryNameInput.trim(),
            statusAktif: categoryStatusInput,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showToast('Kategori Diperbarui', 'Data kategori berhasil diubah.');
      } else {
        const res = await fetch('/api/kategori', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            namaKategori: categoryNameInput.trim(),
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showToast('Kategori Ditambahkan', 'Kategori baru berhasil dibuat.');
      }

      await refreshData();
      setCategoryModalOpen(false);
    } catch (err: any) {
      showToast('Gagal Menyimpan Kategori', err.message, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  // 3. Periode Handlers
  const handleSavePeriod = async () => {
    setSavingPeriod(true);
    try {
      const res = await fetch('/api/periode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaBulanHijriah: selectedBulan,
          tahunHijriah: selectedTahun.toString(),
          statusAktif: periodStatusAktif,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      await refreshData();
      if (periodStatusAktif && json.data?.labelPeriode) {
        setSelectedPeriode(json.data.labelPeriode);
      }
      showToast('Periode Ditambahkan', json.message);
      setPeriodModalOpen(false);
    } catch (err: any) {
      showToast('Gagal Menambah Periode', err.message, 'error');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleSetActivePeriod = async (p: PeriodeItem) => {
    try {
      const res = await fetch('/api/periode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setSelectedPeriode(p.labelPeriode);
      await refreshData();
      showToast('Periode Aktif Diubah', `Periode sekarang: ${p.labelPeriode}`);
    } catch (err: any) {
      showToast('Gagal Mengubah Periode', err.message, 'error');
    }
  };

  const handleDeletePeriodClick = (p: PeriodeItem) => {
    if (periode.length <= 1) {
      showToast('Tidak Dapat Dihapus', 'Minimal harus ada satu periode dalam sistem.', 'error');
      return;
    }
    setPeriodToDelete(p);
    setDeletePeriodModalOpen(true);
  };

  const handleConfirmDeletePeriod = async () => {
    if (!periodToDelete) return;
    setDeletingPeriod(true);
    try {
      const res = await fetch(`/api/periode?id=${encodeURIComponent(periodToDelete.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menghapus periode.');

      if (periodToDelete.labelPeriode === selectedPeriode) {
        const remaining = periode.filter(p => p.id !== periodToDelete.id);
        if (remaining.length > 0) {
          setSelectedPeriode(remaining[0].labelPeriode);
        }
      }

      await refreshData();
      showToast('Periode Dihapus', `Periode "${periodToDelete.labelPeriode}" berhasil dihapus.`);
      setDeletePeriodModalOpen(false);
      setPeriodToDelete(null);
    } catch (err: any) {
      showToast('Gagal Menghapus Periode', err.message, 'error');
    } finally {
      setDeletingPeriod(false);
    }
  };

  const handleDeleteCategoryClick = (kat: KategoriItem) => {
    if (kategori.length <= 1) {
      showToast('Tidak Dapat Dihapus', 'Minimal harus ada satu kategori kas dalam sistem.', 'error');
      return;
    }
    setCategoryToDelete(kat);
    setDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeletingCategory(true);
    try {
      const res = await fetch(`/api/kategori?id=${encodeURIComponent(categoryToDelete.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menghapus kategori.');

      await refreshData();
      showToast('Kategori Dihapus', `Kategori "${categoryToDelete.namaKategori}" berhasil dihapus.`);
      setDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    } catch (err: any) {
      showToast('Gagal Menghapus Kategori', err.message, 'error');
    } finally {
      setDeletingCategory(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal membersihkan data.');

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mmd_offline_cache');
          localStorage.removeItem('mmd_selected_periode');
        } catch (e) {}
      }

      await refreshData();
      showToast('Data Bersih & Cache Dihapus', 'Aplikasi telah dikembalikan ke kondisi awal tanpa data uji coba.');
      setResetModalOpen(false);
    } catch (err: any) {
      showToast('Gagal Mereset Data', err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  // 4. Backup Handler
  const handleDownloadBackup = () => {
    window.open('/api/backup', '_blank');
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header Ringkas */}
      <div className="flex flex-col pt-space-md pb-space-lg">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-primary text-[24px]">tune</span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
            Pengaturan & Integrasi
          </h2>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Konfigurasi koneksi Google Sheets, periode kalender Hijriyah, dan kategori divisi kas pesantren.
        </p>
      </div>

      {/* 1. Google Sheets Connection Section */}
      <section className="flex flex-col gap-space-sm mb-space-xl">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">cloud_sync</span>
            <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
              Integrasi Google Sheets
            </h3>
          </div>
          <span className="font-label-sm text-label-sm text-primary flex items-center gap-1 font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus?.connected ? 'bg-tertiary animate-pulse' : 'bg-amber-500'
              }`}
            ></span>{' '}
            {syncStatus?.connected ? 'Tersinkron Otomatis' : 'Mode Lokal'}
          </span>
        </div>

        {/* Connection Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-[0_4px_20px_-2px_rgba(15,118,110,0.06),0_2px_6px_-1px_rgba(0,0,0,0.04)] border border-surface-container flex flex-col gap-space-md">
          {/* Status Badge & File Name */}
          <div className="flex items-start justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  syncStatus?.connected
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                <span className="material-symbols-outlined text-[26px]">table_chart</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-md text-headline-md text-on-surface font-bold truncate">
                  {syncStatus?.spreadsheetName || 'Buku_Kas_MMD_1448H'}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                  Status:{' '}
                  <span className="font-mono text-[11px] bg-surface-container-low px-1.5 py-0.5 rounded font-semibold">
                    {syncStatus?.connected ? 'Online Terhubung' : 'Lokal Fallback'}
                  </span>
                </span>
              </div>
            </div>

            <span
              className={`font-label-sm text-label-sm px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 font-semibold shadow-sm ${
                syncStatus?.connected
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {syncStatus?.connected ? 'verified' : 'info'}
              </span>{' '}
              {syncStatus?.connected ? 'Terhubung' : 'Belum Sync'}
            </span>
          </div>

          {/* Sync Status & Details */}
          <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
              <span className="font-body-sm text-body-sm">
                Terakhir diperiksa:{' '}
                <strong className="text-on-surface font-semibold">
                  {syncStatus?.lastSyncTime || 'Hari ini'}
                </strong>
              </span>
            </div>
            {syncStatus?.error ? (
              <p className="font-label-sm text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-1">
                {syncStatus.error}
              </p>
            ) : (
              <p className="font-label-sm text-label-sm text-on-surface-variant pl-5 opacity-90">
                Setiap transaksi otomatis tersimpan ke tab Pengeluaran & Subsidi di Google Sheets.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-space-sm pt-space-xs">
            <button
              onClick={handleTestConnection}
              disabled={testingSync}
              className="w-full h-11 rounded-xl bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary transition-all font-label-md text-label-md flex items-center justify-center gap-space-xs active:scale-98 font-semibold"
              type="button"
            >
              {testingSync ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Memeriksa Status Koneksi...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  <span>Uji Koneksi Google Sheets</span>
                </>
              )}
            </button>

            <a
              href={process.env.NEXT_PUBLIC_SPREADSHEET_URL || 'https://docs.google.com/spreadsheets/d/1hmSi654XDAybgL0ishZxdTJBn_UmvCyGlvFQrEaKnt0/edit'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center py-2 text-primary font-label-md text-label-md flex items-center justify-center gap-1 hover:underline"
            >
              <span>Buka Spreadsheet di Tab Baru</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>

            <button
              onClick={() => setGuideModalOpen(true)}
              className="w-full text-center py-1.5 text-on-surface-variant font-label-sm text-label-sm flex items-center justify-center gap-1 hover:text-primary"
              type="button"
            >
              <span>Lihat Panduan Menghubungkan Google Sheets</span>
              <span className="material-symbols-outlined text-[15px]">help_outline</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Kelola Periode Hijriyah (Section H) */}
      <section className="flex flex-col gap-space-sm mb-space-xl">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">
              calendar_month
            </span>
            <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
              Kelola Periode Hijriyah
            </h3>
          </div>
          <button
            onClick={() => setPeriodModalOpen(true)}
            className="h-8 px-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-sm text-label-sm flex items-center gap-1 active:scale-95 shadow-sm font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tambah Periode</span>
          </button>
        </div>

        <div className="flex flex-col gap-space-sm">
          {periode.map(p => {
            const isCurrentlyActive = p.statusAktif || selectedPeriode === p.labelPeriode;
            return (
              <div
                key={p.id}
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex items-center justify-between gap-space-sm"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCurrentlyActive
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-md text-sm text-on-surface font-bold truncate">
                      {p.labelPeriode}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {isCurrentlyActive ? 'Periode Aktif Pembukuan' : 'Periode Lainnya'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isCurrentlyActive ? (
                    <span className="px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-[11px] font-bold">
                      Aktif
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetActivePeriod(p)}
                      className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary text-[11px] font-semibold active:scale-95 transition-all"
                    >
                      Pilih Aktif
                    </button>
                  )}
                  {periode.length > 1 && !isCurrentlyActive && (
                    <button
                      type="button"
                      aria-label={`Hapus Periode ${p.labelPeriode}`}
                      onClick={() => handleDeletePeriodClick(p)}
                      className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 flex items-center justify-center active:scale-95 transition-colors"
                      title="Hapus Periode"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Kelola Kategori Transaksi */}
      <section className="flex flex-col gap-space-sm mb-space-xl">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">category</span>
            <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
              Kategori Divisi Kas
            </h3>
          </div>
          <button
            onClick={openAddCategory}
            className="h-8 px-3 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-sm text-label-sm flex items-center gap-1 active:scale-95 shadow-sm font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tambah</span>
          </button>
        </div>

        <div className="flex flex-col gap-space-sm">
          {kategori.map(kat => (
            <div
              key={kat.id}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex items-center justify-between gap-space-sm"
            >
              <div className="flex items-center gap-space-sm min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-container-high text-primary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {kat.iconName || 'account_balance'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-md text-sm text-on-surface font-semibold truncate">
                    {kat.namaKategori}
                  </span>
                  <div className="flex items-center gap-space-xs mt-0.5">
                    <span
                      className={`font-label-sm text-[11px] font-medium ${
                        kat.statusAktif ? 'text-tertiary' : 'text-on-surface-variant'
                      }`}
                    >
                      {kat.statusAktif ? 'Aktif di Formulir' : 'Dinonaktifkan'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  aria-label={`Edit Kategori ${kat.namaKategori}`}
                  className="w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center justify-center active:scale-95 flex-shrink-0 transition-colors"
                  onClick={() => openEditCategory(kat)}
                  type="button"
                  title="Edit Nama Kategori"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                {kategori.length > 1 && (
                  <button
                    aria-label={`Hapus Kategori ${kat.namaKategori}`}
                    className="w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 flex items-center justify-center active:scale-95 flex-shrink-0 transition-colors"
                    onClick={() => handleDeleteCategoryClick(kat)}
                    type="button"
                    title="Hapus Kategori"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Informasi Aplikasi & Backup */}
      <section className="flex flex-col gap-space-sm mb-space-xl">
        <div className="flex items-center gap-space-xs px-space-xs">
          <span className="material-symbols-outlined text-primary text-[18px]">info</span>
          <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
            Tentang Aplikasi & Data Kas
          </h3>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md relative overflow-hidden">
          <div className="flex items-center gap-space-md">
            <img
              alt="Logo Bendahara MMD - MIDA Sumbersari"
              className="w-14 h-14 object-contain bg-surface-container-low p-1.5 rounded-xl flex-shrink-0 shadow-xs"
              src="/logo.png"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  Bendahara MMD
                </span>
                <span className="bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm px-2 py-0.5 rounded-full font-bold">
                  AMANAH
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                MIDA • Sumbersari, Kediri
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-space-xs pt-space-xs text-xs divide-y divide-surface-container">
            <div className="flex justify-between items-center py-1">
              <span className="text-on-surface-variant">Lembaga</span>
              <span className="font-semibold text-on-surface">Majelis Musyawarah & Dirosah</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-on-surface-variant">Arsitektur</span>
              <span className="font-semibold text-on-surface">Next.js + Google Apps Script</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-on-surface-variant">Tata Kelola Kas</span>
              <span className="text-primary font-medium">Amanah, Transparan, & Barokah</span>
            </div>
          </div>

          {/* Action Buttons Backup & Manual */}
          <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
            <button
              className="h-11 rounded-xl bg-surface-container-high text-primary hover:bg-surface-variant font-label-md text-label-md font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform"
              onClick={handleDownloadBackup}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_download</span>
              <span>Cadangkan Data</span>
            </button>
            <button
              className="h-11 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-variant font-label-md text-label-md font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform"
              onClick={() => setGuideModalOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Buka Panduan</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. Pembersihan Cache & Reset Simulasi */}
      <section className="flex flex-col gap-space-sm mb-space-xl">
        <div className="flex items-center gap-space-xs px-space-xs">
          <span className="material-symbols-outlined text-amber-700 text-[18px]">restart_alt</span>
          <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
            Pembersihan Data & Cache Browser
          </h3>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-amber-200/60 bg-amber-50/20 flex flex-col gap-space-sm">
          <div className="flex items-start gap-space-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">cleaning_services</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-md text-sm text-on-surface font-bold">
                Bersihkan Data Uji Coba & Cache Lokal
              </span>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                Jika Anda melihat data simulasi atau nama yang tidak pernah Anda masukkan, Anda dapat membersihkan cache browser dan mengembalikan data sistem ke kondisi awal yang bersih.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="w-full h-11 mt-1 rounded-xl bg-surface-container-high hover:bg-amber-100 text-amber-950 font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all border border-amber-300/40"
          >
            <span className="material-symbols-outlined text-[18px]">cached</span>
            <span>Bersihkan Cache & Reset Data Awal</span>
          </button>
        </div>
      </section>

      {/* Modal Kelola Kategori */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-lg shadow-2xl flex flex-col gap-space-md animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                {categoryToEdit ? 'Ubah Nama Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center"
                onClick={() => setCategoryModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                Nama Kategori
              </label>
              <input
                className="w-full h-12 px-space-md bg-surface-container-lowest text-on-surface rounded-xl outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary font-body-md text-body-md transition-shadow"
                placeholder="Contoh: Takmir Masjid, Kitab Santri..."
                type="text"
                value={categoryNameInput}
                onChange={e => setCategoryNameInput(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-xl">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Status Kategori
                </span>
                <span className="font-body-sm text-xs text-on-surface-variant">
                  Tampilkan saat pencatatan transaksi
                </span>
              </div>
              <button
                className={`w-12 h-7 rounded-full relative flex items-center px-1 transition-colors ${
                  categoryStatusInput ? 'bg-primary' : 'bg-surface-dim'
                }`}
                onClick={() => setCategoryStatusInput(!categoryStatusInput)}
                type="button"
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                    categoryStatusInput ? 'translate-x-5' : 'translate-x-0'
                  }`}
                ></span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              <button
                className="h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold active:scale-95"
                onClick={() => setCategoryModalOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-95 shadow-sm disabled:opacity-50"
                onClick={handleSaveCategory}
                disabled={savingCategory}
                type="button"
              >
                {savingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Periode Hijriyah */}
      {periodModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-lg shadow-2xl flex flex-col gap-space-md animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">
                  calendar_add_on
                </span>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Tambah Periode Baru
                </h3>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center"
                onClick={() => setPeriodModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-xs text-on-surface-variant">
              Buka pembukuan kas baru untuk siklus kalender Hijriyah pesantren MMD.
            </p>

            {/* Bulan Selector */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                Bulan Hijriyah
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-11 bg-surface-container-low text-on-surface rounded-xl px-3 font-body-md text-body-md appearance-none pr-10 focus:outline-none border border-surface-container font-medium"
                  value={selectedBulan}
                  onChange={e => setSelectedBulan(e.target.value)}
                >
                  {BULAN_HIJRIAH_LIST.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  expand_more
                </span>
              </div>
            </div>

            {/* Tahun Stepper */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                Tahun Hijriyah
              </label>
              <div className="flex items-center bg-surface-container-low rounded-xl p-1 justify-between border border-surface-container">
                <button
                  className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                  onClick={() => setSelectedTahun(prev => Math.max(1400, prev - 1))}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <div className="flex items-baseline gap-1">
                  <input
                    className="font-title-currency-md text-title-currency-md text-center font-bold text-on-surface bg-transparent w-20 focus:outline-none"
                    type="number"
                    value={selectedTahun}
                    onChange={e => setSelectedTahun(parseInt(e.target.value, 10) || 1448)}
                  />
                  <span className="font-label-md text-label-md text-on-surface-variant font-semibold">
                    H
                  </span>
                </div>
                <button
                  className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                  onClick={() => setSelectedTahun(prev => prev + 1)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>

            {/* Checkbox Jadikan Aktif */}
            <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-2 cursor-pointer">
              <input
                id="makeActive"
                type="checkbox"
                checked={periodStatusAktif}
                onChange={e => setPeriodStatusAktif(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-0 accent-primary cursor-pointer"
              />
              <label htmlFor="makeActive" className="text-xs text-on-surface font-semibold cursor-pointer">
                Jadikan sebagai periode pembukuan aktif sekarang
              </label>
            </div>

            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              <button
                className="h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold active:scale-95"
                onClick={() => setPeriodModalOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-95 shadow-sm disabled:opacity-50"
                onClick={handleSavePeriod}
                disabled={savingPeriod}
                type="button"
              >
                {savingPeriod ? 'Menyimpan...' : 'Buat Periode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan Lengkap Pemula */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-2xl p-space-lg shadow-2xl flex flex-col gap-space-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">menu_book</span>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Panduan Integrasi Google Sheets
                </h3>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center"
                onClick={() => setGuideModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs leading-relaxed text-on-surface-variant">
              <p className="text-on-surface font-semibold">
                Ikuti langkah mudah berikut untuk menghubungkan Google Sheets Anda dengan aplikasi Bendahara MMD:
              </p>

              <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1.5 border border-surface-container">
                <span className="font-bold text-primary text-sm">Langkah 1: Buat Spreadsheet Baru</span>
                <p>
                  1. Buka <strong>sheets.google.com</strong> dan buat spreadsheet kosong baru.
                  <br />
                  2. Beri nama spreadsheet, misalnya <em>Buku_Kas_MMD_1448H</em>.
                </p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1.5 border border-surface-container">
                <span className="font-bold text-primary text-sm">Langkah 2: Buka Apps Script</span>
                <p>
                  1. Pada menu atas Google Sheets, klik <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.
                  <br />
                  2. Hapus kode default, lalu salin seluruh isi file <code>google-apps-script/Code.gs</code> yang ada di folder project ini.
                  <br />
                  3. Klik ikon simpan (Save / Ctrl+S).
                </p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1.5 border border-surface-container">
                <span className="font-bold text-primary text-sm">Langkah 3: Deploy sebagai Web App</span>
                <p>
                  1. Klik tombol <strong>Deploy</strong> (kanan atas) &gt; <strong>Penerapan baru (New deployment)</strong>.
                  <br />
                  2. Pilih jenis: <strong>Aplikasi Web (Web App)</strong>.
                  <br />
                  3. Isi deskripsi: <em>API Kas MMD</em>.
                  <br />
                  4. Jalankan sebagai: <strong>Saya (email Anda)</strong>.
                  <br />
                  5. Siapa yang memiliki akses: <strong>Siapa saja (Anyone)</strong>.
                  <br />
                  6. Klik <strong>Deploy</strong> dan beri izin akses saat diminta Google.
                  <br />
                  7. Salin <strong>URL Aplikasi Web (Web App URL)</strong> yang berakhiran <code>/exec</code>.
                </p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1.5 border border-surface-container">
                <span className="font-bold text-primary text-sm">Langkah 4: Masukkan URL ke Aplikasi</span>
                <p>
                  Buka file <code>.env.local</code> di folder project ini, lalu tempelkan URL tersebut pada baris:
                  <br />
                  <code className="block bg-surface-container-lowest p-1.5 rounded font-mono text-[11px] text-primary mt-1 border">
                    GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXX/exec
                  </code>
                </p>
              </div>

              <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 text-primary">
                <span className="font-bold block mb-1">Keamanan Terjamin!</span>
                Semua komunikasi browser dilakukan melalui backend server aplikasi Next.js sehingga kredensial Google Anda tidak pernah terekspos ke publik.
              </div>
            </div>

            <button
              onClick={() => setGuideModalOpen(false)}
              className="w-full h-11 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-semibold active:scale-95 shadow-sm mt-2"
              type="button"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Periode */}
      <DeleteConfirmModal
        isOpen={deletePeriodModalOpen}
        title="Hapus Periode Pembukuan?"
        message={`Apakah Anda yakin ingin menghapus periode "${periodToDelete?.labelPeriode}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleConfirmDeletePeriod}
        onCancel={() => {
          setDeletePeriodModalOpen(false);
          setPeriodToDelete(null);
        }}
        loading={deletingPeriod}
      />

      {/* Modal Konfirmasi Hapus Kategori */}
      <DeleteConfirmModal
        isOpen={deleteCategoryModalOpen}
        title="Hapus Kategori Kas?"
        message={`Apakah Anda yakin ingin menghapus kategori "${categoryToDelete?.namaKategori}"?`}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => {
          setDeleteCategoryModalOpen(false);
          setCategoryToDelete(null);
        }}
        loading={deletingCategory}
      />

      {/* Modal Konfirmasi Reset Cache & Data */}
      <DeleteConfirmModal
        isOpen={resetModalOpen}
        title="Bersihkan Cache & Reset Data Awal?"
        message="Tindakan ini akan mengosongkan seluruh data simulasi pengujian dan membersihkan cache browser Anda sehingga aplikasi kembali bersih ke kondisi awal."
        onConfirm={handleConfirmReset}
        onCancel={() => setResetModalOpen(false)}
        loading={resetting}
      />
    </div>
  );
}
