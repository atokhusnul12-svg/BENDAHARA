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
    deleteRecord,
    isAdmin,
  } = useApp();

  const [testingSync, setTestingSync] = useState(false);
  const [generatingCetak, setGeneratingCetak] = useState(false);

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

  // Kunci scrolling halaman latar ketika salah satu modal sedang terbuka
  React.useEffect(() => {
    const isAnyModalOpen =
      categoryModalOpen ||
      periodModalOpen ||
      guideModalOpen ||
      deletePeriodModalOpen ||
      deleteCategoryModalOpen ||
      resetModalOpen;

    if (!isAnyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [
    categoryModalOpen,
    periodModalOpen,
    guideModalOpen,
    deletePeriodModalOpen,
    deleteCategoryModalOpen,
    resetModalOpen,
  ]);

  // 1. Test Connection Handler
  const handleTestConnection = async () => {
    setTestingSync(true);
    try {
      const res = await fetch('/api/status', {
        signal: AbortSignal.timeout(12000),
      });
      const json = await res.json();
      if (json.data?.connected) {
        showToast('Koneksi Google Sheets Berhasil', 'Spreadsheet tersinkronisasi sempurna.');
      } else {
        showToast('Pemeriksaan Selesai', json.data?.error || 'Aplikasi dalam mode penyimpanan lokal.', 'info');
      }
      refreshData().catch(() => {});
    } catch (e: any) {
      showToast('Gagal memeriksa koneksi', e.message || 'Waktu koneksi habis.', 'error');
    } finally {
      setTestingSync(false);
    }
  };

  const handleSyncCetakLaporan = async () => {
    setGeneratingCetak(true);
    try {
      const res = await fetch('/api/cetak-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: selectedPeriode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memperbarui sheet cetak.');
      }
      showToast(
        'Sheet Cetak Berhasil Disusun',
        'Tab "CETAK_PENGELUARAN" di Google Sheets telah selesai disusun rapi per kelompok jenis acara.'
      );
    } catch (err: any) {
      showToast('Gagal Memperbarui Sheet Cetak', err.message || 'Periksa koneksi Google Sheets.', 'error');
    } finally {
      setGeneratingCetak(false);
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
      showToast('Nama Kategori Kosong', 'Silakan isi nama kategori kas.', 'error');
      return;
    }

    setSavingCategory(true);
    try {
      const payload: any = {
        namaKategori: categoryNameInput.trim(),
        statusAktif: categoryStatusInput,
      };
      if (categoryToEdit) payload.id = categoryToEdit.id;

      const res = await fetch('/api/kategori', {
        method: categoryToEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.status === 401) {
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
      }
      if (!json.success) throw new Error(json.error);

      showToast(
        categoryToEdit ? 'Kategori Diperbarui' : 'Kategori Baru Dibuat',
        json.message
      );
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
      if (res.status === 401) {
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
      }
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
      if (res.status === 401) {
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
      }
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
      await deleteRecord('periode', periodToDelete.id);

      if (periodToDelete.labelPeriode === selectedPeriode) {
        const remaining = periode.filter(p => p.id !== periodToDelete.id);
        if (remaining.length > 0) {
          setSelectedPeriode(remaining[0].labelPeriode);
        }
      }

      showToast('Periode Dihapus', `Periode "${periodToDelete.labelPeriode}" berhasil dihapus.`);
      setDeletePeriodModalOpen(false);
      setPeriodToDelete(null);
    } catch (err: any) {
      showToast('Gagal Menghapus Periode', err.message || 'Terjadi kesalahan sistem.', 'error');
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
      await deleteRecord('kategori', categoryToDelete.id);
      showToast('Kategori Dihapus', `Kategori "${categoryToDelete.namaKategori}" berhasil dihapus.`);
      setDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    } catch (err: any) {
      showToast('Gagal Menghapus Kategori', err.message || 'Terjadi kesalahan sistem.', 'error');
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
      if (res.status === 401) {
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
      }
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

  return (
    <div className="flex flex-col w-full space-y-6 pb-12">
      {/* 1. Header Pengaturan Ringkas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-surface-variant">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
            <h2 className="font-headline-md text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              Pengaturan & Konfigurasi Kas
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant font-medium mt-1">
            Konfigurasi koneksi Google Sheets, siklus kalender Hijriyah, divisi kas, dan pemeliharaan data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-primary/8 text-primary font-bold rounded-xl border border-primary/15">
            Admin Bendahara
          </span>
        </div>
      </div>

      {/* 2. Grid Responsif Desktop (2 Kolom Seimbang) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ==================== KOLOM KIRI ==================== */}
        <div className="flex flex-col space-y-6">
          {/* A. Integrasi Google Sheets */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">cloud_sync</span>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Integrasi Google Sheets
                </h3>
              </div>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 ${
                  syncStatus?.connected
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${syncStatus?.connected ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                <span>{syncStatus?.connected ? 'Tersinkron' : 'Lokal Fallback'}</span>
              </span>
            </div>

            <div className="bg-surface-container/60 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Spreadsheet Target:</span>
                <span className="font-bold text-on-surface truncate max-w-[200px]">
                  {syncStatus?.spreadsheetName || 'Laporan_Pengeluaran'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Terakhir Diperiksa:</span>
                <span className="font-semibold text-on-surface tabular-nums">
                  {syncStatus?.lastSyncTime || 'Hari ini'}
                </span>
              </div>
              {syncStatus?.error && (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                  {syncStatus.error}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testingSync}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs disabled:opacity-50"
                type="button"
              >
                {testingSync ? (
                  <>
                    <span className="material-symbols-outlined text-[17px] animate-spin">
                      progress_activity
                    </span>
                    <span>Memeriksa Koneksi Google Apps Script...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">sync</span>
                    <span>Uji Koneksi Google Sheets Sekarang</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={process.env.NEXT_PUBLIC_SPREADSHEET_URL || 'https://docs.google.com/spreadsheets/d/1PAqCW-KV52-5X5GUn61tAhYst3kOd5TvJuHnRTQvfig/edit'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 rounded-xl bg-white hover:bg-surface-container text-primary border border-surface-variant text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Buka Spreadsheet</span>
                </a>

                <button
                  onClick={() => setGuideModalOpen(true)}
                  className="h-10 rounded-xl bg-white hover:bg-surface-container text-on-surface border border-surface-variant text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">help_outline</span>
                  <span>Panduan Setup</span>
                </button>
              </div>

              {/* Tombol Perbarui Sheet Cetak (CETAK_PENGELUARAN) */}
              <button
                onClick={handleSyncCetakLaporan}
                disabled={generatingCetak}
                className="w-full h-11 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                type="button"
                title="Menyusun ulang format kelompok jenis acara siap cetak di Google Sheets"
              >
                <span className={`material-symbols-outlined text-[18px] text-forest-700 ${generatingCetak ? 'animate-spin' : ''}`}>
                  {generatingCetak ? 'progress_activity' : 'receipt_long'}
                </span>
                <span>{generatingCetak ? 'Menyusun Format Cetak di Google Sheets...' : 'Perbarui Sheet Cetak (CETAK_PENGELUARAN)'}</span>
              </button>
            </div>
          </section>

          {/* B. Pembersihan Cache Offline */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant flex flex-col space-y-3">
            <div className="flex items-center gap-2 border-b border-surface-container pb-3">
              <span className="material-symbols-outlined text-[20px] text-amber-800">cleaning_services</span>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                Pembersihan Cache Offline
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Jika peramban Anda menampilkan data lama yang belum tersinkron, bersihkan cache lokal browser untuk memuat ulang kondisi kas terkini dari Google Sheets.
            </p>
            <button
              onClick={() => setResetModalOpen(true)}
              className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-amber-900 border border-surface-variant text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">cached</span>
              <span>Bersihkan Cache & Sinkron Ulang</span>
            </button>
          </section>
        </div>

        {/* ==================== KOLOM KANAN ==================== */}
        <div className="flex flex-col space-y-6">
          {/* D. Kelola Periode Hijriyah */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">calendar_month</span>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Kelola Periode Hijriyah
                </h3>
              </div>
              <button
                onClick={() => setPeriodModalOpen(true)}
                className="h-8 px-3 rounded-lg bg-primary/8 hover:bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all border border-primary/15"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Tambah</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {periode.map(p => {
                const isCurrentlyActive = p.statusAktif || selectedPeriode === p.labelPeriode;
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-surface-container/50 border border-surface-variant flex items-center justify-between gap-3 hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-surface-variant flex items-center justify-center text-primary font-bold flex-shrink-0">
                        <span className="material-symbols-outlined text-[17px]">calendar_today</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                          {p.labelPeriode}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {isCurrentlyActive ? 'Periode Aktif Terpilih' : 'Arsip Pembukuan'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isCurrentlyActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          Aktif
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetActivePeriod(p)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-surface-variant text-primary hover:bg-primary hover:text-white text-[11px] font-semibold active:scale-95 transition-all"
                        >
                          Pilih Aktif
                        </button>
                      )}

                      {periode.length > 1 && !isCurrentlyActive && (
                        <button
                          type="button"
                          onClick={() => handleDeletePeriodClick(p)}
                          className="w-7 h-7 rounded-lg text-rose-700 hover:bg-rose-50 flex items-center justify-center active:scale-95 transition-colors"
                          title="Hapus Periode"
                          aria-label={`Hapus Periode ${p.labelPeriode}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* E. Kelola Kategori Divisi Kas */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-variant flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">category</span>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Kategori Divisi Kas
                </h3>
              </div>
              <button
                onClick={openAddCategory}
                className="h-8 px-3 rounded-lg bg-primary/8 hover:bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all border border-primary/15"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Tambah</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {kategori.map(kat => (
                <div
                  key={kat.id}
                  className="p-3 rounded-xl bg-surface-container/50 border border-surface-variant flex items-center justify-between gap-3 hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-surface-variant text-primary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {kat.iconName || 'account_balance'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                        {kat.namaKategori}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {kat.statusAktif ? 'Aktif dalam Formulir' : 'Dinonaktifkan'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditCategory(kat)}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="Edit Kategori"
                      aria-label={`Edit ${kat.namaKategori}`}
                    >
                      <span className="material-symbols-outlined text-[17px]">edit</span>
                    </button>
                    {kategori.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryClick(kat)}
                        className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
                        title="Hapus Kategori"
                        aria-label={`Hapus ${kat.namaKategori}`}
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Modal Kelola / Tambah Kategori */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-[100] bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90dvh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center px-5 py-4 border-b border-surface-container">
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                {categoryToEdit ? 'Ubah Nama Kategori Kas' : 'Tambah Kategori Kas Baru'}
              </h3>
              <button
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-95"
                onClick={() => setCategoryModalOpen(false)}
                type="button"
                aria-label="Tutup"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">
                  Nama Kategori / Lajnah
                </label>
                <input
                  className="w-full h-11 px-3.5 bg-white text-on-surface rounded-xl border border-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  placeholder="Contoh: Takmir Masjid, Takziran..."
                  type="text"
                  value={categoryNameInput}
                  onChange={e => setCategoryNameInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-container/50 rounded-xl border border-surface-container">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Status Kategori</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Tampilkan saat pencatatan transaksi
                  </span>
                </div>
                <button
                  className={`w-11 h-6 rounded-full relative flex items-center px-1 transition-colors ${
                    categoryStatusInput ? 'bg-primary' : 'bg-surface-dim'
                  }`}
                  onClick={() => setCategoryStatusInput(!categoryStatusInput)}
                  type="button"
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                      categoryStatusInput ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-surface-container grid grid-cols-2 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                className="h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold active:scale-95 transition-all"
                onClick={() => setCategoryModalOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-10 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold active:scale-95 shadow-xs transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-[100] bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90dvh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center px-5 py-4 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">calendar_add_on</span>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Tambah Periode Hijriyah
                </h3>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-95"
                onClick={() => setPeriodModalOpen(false)}
                type="button"
                aria-label="Tutup"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">Bulan Hijriyah</label>
                <select
                  className="w-full h-11 bg-white text-on-surface rounded-xl px-3 border border-surface-variant text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={selectedBulan}
                  onChange={e => setSelectedBulan(e.target.value)}
                >
                  {BULAN_HIJRIAH_LIST.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface">Tahun Hijriyah</label>
                <div className="flex items-center bg-surface-container/60 rounded-xl p-1 justify-between border border-surface-variant">
                  <button
                    className="w-9 h-9 rounded-lg bg-white text-on-surface flex items-center justify-center shadow-xs active:scale-90"
                    onClick={() => setSelectedTahun(prev => Math.max(1400, prev - 1))}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <div className="flex items-baseline gap-1">
                    <input
                      className="text-center font-bold text-on-surface bg-transparent w-20 text-sm focus:outline-none tabular-nums"
                      type="number"
                      value={selectedTahun}
                      onChange={e => setSelectedTahun(parseInt(e.target.value, 10) || 1448)}
                    />
                    <span className="text-xs text-on-surface-variant font-semibold">H</span>
                  </div>
                  <button
                    className="w-9 h-9 rounded-lg bg-white text-on-surface flex items-center justify-center shadow-xs active:scale-90"
                    onClick={() => setSelectedTahun(prev => prev + 1)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>

              <div className="bg-surface-container/50 p-3 rounded-xl flex items-center gap-2 border border-surface-container">
                <input
                  id="makeActivePeriod"
                  type="checkbox"
                  checked={periodStatusAktif}
                  onChange={e => setPeriodStatusAktif(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-0 accent-primary cursor-pointer"
                />
                <label htmlFor="makeActivePeriod" className="text-xs text-on-surface font-semibold cursor-pointer">
                  Jadikan periode pembukuan aktif sekarang
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-surface-container grid grid-cols-2 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                className="h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold active:scale-95 transition-all"
                onClick={() => setPeriodModalOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-10 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold active:scale-95 shadow-xs transition-all disabled:opacity-50"
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

      {/* Modal Panduan Menghubungkan Google Sheets */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-[100] bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-[88dvh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center px-5 py-4 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">menu_book</span>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Panduan Integrasi Google Sheets
                </h3>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-95"
                onClick={() => setGuideModalOpen(false)}
                type="button"
                aria-label="Tutup Panduan"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto overscroll-contain space-y-4 text-xs text-on-surface leading-relaxed">
              <div className="p-3 bg-primary/8 rounded-xl border border-primary/15">
                <p className="font-bold text-primary mb-1">Status Koneksi Aktif:</p>
                <p>
                  Aplikasi telah dikonfigurasi langsung dengan Google Apps Script Web App. Setiap kali transaksi dicatat, data dikirim langsung ke spreadsheet tanpa perantara.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-on-surface mb-1">1. Struktur Spreadsheet</h4>
                <p className="text-on-surface-variant">
                  Spreadsheet wajib memiliki dua sheet utama: <strong>Pengeluaran</strong> dan <strong>Subsidi</strong>.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-on-surface mb-1">2. Pembaruan Kode Apps Script</h4>
                <p className="text-on-surface-variant">
                  Kode Google Apps Script tersimpan di berkas <code>google-apps-script/Code.gs</code>. Jika melakukan update, deploy versi baru di Google Apps Script editor.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-surface-container pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                className="w-full h-10 rounded-xl bg-primary text-white text-xs font-semibold active:scale-95 transition-all shadow-xs"
                onClick={() => setGuideModalOpen(false)}
                type="button"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Periode */}
      <DeleteConfirmModal
        isOpen={deletePeriodModalOpen}
        title="Hapus Periode Hijriyah?"
        message={`Apakah Anda yakin ingin menghapus periode "${periodToDelete?.labelPeriode}"? Transaksi pada periode ini tidak akan terhapus, namun tidak dapat dipilih sebagai periode aktif.`}
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
        message={`Apakah Anda yakin ingin menghapus kategori "${categoryToDelete?.namaKategori}"? Catatan transaksi yang telah menggunakan kategori ini akan tetap aman.`}
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => {
          setDeleteCategoryModalOpen(false);
          setCategoryToDelete(null);
        }}
        loading={deletingCategory}
      />

      {/* Modal Konfirmasi Reset Cache */}
      <DeleteConfirmModal
        isOpen={resetModalOpen}
        title="Bersihkan Cache & Reset Data?"
        message="Tindakan ini akan menghapus cache lokal browser dan mengembalikan database lokal ke kondisi bersih. Data yang telah tersinkron di Google Sheets tetap aman."
        onConfirm={handleConfirmReset}
        onCancel={() => setResetModalOpen(false)}
        loading={resetting}
      />
    </div>
  );
}
