'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { formatNumber, parseRupiah } from '@/lib/format';

export default function SubsidyModal() {
  const {
    isSubsidyModalOpen,
    subsidyToEdit,
    closeSubsidyModal,
    kategori,
    periode,
    selectedPeriode,
    showToast,
    refreshData,
    addSubsidiRecord,
    updateSubsidiRecord,
  } = useApp();

  // Session tracking to ensure modal state is initialized ONCE per session and never wiped out by background refreshes or focus events
  const initializedSessionRef = useRef<string | null>(null);
  const kategoriRef = useRef(kategori);
  kategoriRef.current = kategori;
  const periodeRef = useRef(periode);
  periodeRef.current = periode;
  const selectedPeriodeRef = useRef(selectedPeriode);
  selectedPeriodeRef.current = selectedPeriode;

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [kategoriNama, setKategoriNama] = useState('');
  const [periodeLabel, setPeriodeLabel] = useState('');
  const [tanggalTransaksi, setTanggalTransaksi] = useState('');
  const [nominal, setNominal] = useState(0);
  const [catatan, setCatatan] = useState('');

  // Quick category creation state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Keyboard shortcut Escape untuk menutup modal & body scroll lock
  useEffect(() => {
    if (!isSubsidyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSubsidyModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubsidyModalOpen, closeSubsidyModal]);

  useEffect(() => {
    if (!isSubsidyModalOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = subsidyToEdit
      ? (subsidyToEdit.id ? `edit-${subsidyToEdit.id}` : `create-${subsidyToEdit.kategoriNama || 'card'}`)
      : 'create-new';

    // Prevent re-initialization if already initialized for this modal session
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    setErrorMessage('');
    setIsAddingCategory(false);
    setNewCategoryName('');
    const today = new Date().toISOString().split('T')[0];

    const currentKategori = kategoriRef.current;
    const currentPeriode = periodeRef.current;
    const currentSelectedPeriode = selectedPeriodeRef.current;

    if (subsidyToEdit && subsidyToEdit.id) {
      // Mode Edit
      setKategoriNama(subsidyToEdit.kategoriNama);
      const matchedPer = (subsidyToEdit.bulanHijriah + ' ' + subsidyToEdit.tahunHijriah + ' H').trim();
      setPeriodeLabel(matchedPer || currentSelectedPeriode);
      const rawDate = subsidyToEdit.tanggalTransaksi;
      setTanggalTransaksi(rawDate ? String(rawDate).split('T')[0] : today);
      setNominal(Number(subsidyToEdit.nominal) || 0);
      setCatatan(subsidyToEdit.catatan || '');
    } else {
      // Mode Tambah (bisa dengan kategori default dari card)
      const defaultKat =
        subsidyToEdit?.kategoriNama ||
        currentKategori.find(k => k.statusAktif)?.namaKategori ||
        (currentKategori[0]?.namaKategori ?? 'LBM (Lajnah Bahtsul Masail)');
      setKategoriNama(defaultKat);
      setPeriodeLabel(currentSelectedPeriode || (currentPeriode[0]?.labelPeriode ?? 'Jumadal Ula 1448 H'));
      setTanggalTransaksi(today);
      setNominal(0);
      setCatatan('');
    }
  }, [isSubsidyModalOpen, subsidyToEdit]);

  const handleQuickCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/kategori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaKategori: name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menambahkan kategori.');
      await refreshData();
      setKategoriNama(name);
      setNewCategoryName('');
      setIsAddingCategory(false);
      showToast('Kategori Baru Ditambahkan', `Kategori "${name}" berhasil dibuat dan siap digunakan.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menambahkan kategori baru.');
    } finally {
      setCreatingCategory(false);
    }
  };

  if (!isSubsidyModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Mencegah klik ganda
    setErrorMessage('');

    if (!kategoriNama) {
      setErrorMessage('Kategori kegiatan wajib dipilih.');
      return;
    }
    if (!tanggalTransaksi) {
      setErrorMessage('Tanggal transaksi subsidi wajib diisi.');
      return;
    }
    const nominalNum = Number(nominal);
    if (isNaN(nominalNum) || nominalNum <= 0) {
      setErrorMessage('Nominal subsidi harus lebih besar dari Rp 0.');
      return;
    }

    const matchedPeriode = periode.find(
      p => p.labelPeriode.trim().toLowerCase() === periodeLabel.trim().toLowerCase() || p.id === periodeLabel
    );
    const bulanH = matchedPeriode ? matchedPeriode.namaBulanHijriah : (periodeLabel.split(' ')[0] || 'Jumadal Ula');
    const tahunH = matchedPeriode ? String(matchedPeriode.tahunHijriah) : '1448';
    const periodeId = matchedPeriode ? matchedPeriode.id : periodeLabel;
    const matchedKategori = kategori.find(k => k.namaKategori === kategoriNama);

    setSaving(true);
    try {
      if (subsidyToEdit && subsidyToEdit.id) {
        await updateSubsidiRecord({
          id: subsidyToEdit.id,
          kategoriNama,
          kategoriId: matchedKategori?.id || '',
          bulanHijriah: bulanH,
          tahunHijriah: tahunH,
          periodeId,
          tanggalTransaksi,
          nominal: nominalNum,
          catatan: catatan.trim(),
        });
        closeSubsidyModal();
      } else {
        await addSubsidiRecord({
          kategoriNama,
          kategoriId: matchedKategori?.id || '',
          bulanHijriah: bulanH,
          tahunHijriah: tahunH,
          periodeId,
          tanggalTransaksi,
          nominal: nominalNum,
          catatan: catatan.trim(),
        });
        closeSubsidyModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan subsidi.');
    } finally {
      setSaving(false);
    }
  };

  const isEditMode = Boolean(subsidyToEdit && subsidyToEdit.id);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSubsidyModal();
      }}
      className="fixed inset-0 z-[100] bg-ink-900/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 overscroll-contain"
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-center text-forest-700 flex-shrink-0">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                volunteer_activism
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg text-ink-900 font-bold tracking-tight">
                {isEditMode ? 'Edit Alokasi Subsidi' : 'Tambah Alokasi Subsidi'}
              </h2>
              <span className="text-xs text-ink-500 font-medium">
                Bendahara MMD • Alokasi Kas Amanah
              </span>
            </div>
          </div>
          <button
            onClick={closeSubsidyModal}
            className="w-8 h-8 rounded-full bg-surface-subtle text-ink-500 hover:text-ink-900 hover:bg-neutral-200 flex items-center justify-center active:scale-95 transition-all"
            type="button"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 flex flex-col gap-4">
            {errorMessage && (
              <div className="bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-200 flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in">
                <span className="material-symbols-outlined text-[20px] text-red-600 flex-shrink-0">
                  error
                </span>
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Kategori Divisi */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Kategori Divisi Pos Anggaran
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(prev => !prev)}
                  className="text-forest-700 hover:text-forest-800 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isAddingCategory ? 'close' : 'add'}
                  </span>
                  <span>{isAddingCategory ? 'Batal' : '+ Kategori Baru'}</span>
                </button>
              </div>

              {isAddingCategory && (
                <div className="flex items-center gap-2 p-2.5 bg-forest-50/50 rounded-xl border border-forest-200 animate-in fade-in duration-200">
                  <input
                    type="text"
                    placeholder="Nama divisi/kategori baru..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-white text-ink-900 text-xs border border-border focus:outline-none focus:ring-1 focus:ring-forest-600 font-medium"
                  />
                  <button
                    type="button"
                    disabled={creatingCategory || !newCategoryName.trim()}
                    onClick={handleQuickCreateCategory}
                    className="h-9 px-3.5 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 disabled:opacity-50 hover:bg-forest-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    <span>{creatingCategory ? 'Menyimpan...' : 'Simpan'}</span>
                  </button>
                </div>
              )}

              <div className="relative w-full">
                <select
                  className="w-full h-11 pl-3 pr-9 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border appearance-none focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                  value={kategoriNama}
                  onChange={e => {
                    if (e.target.value === '__NEW__') {
                      setIsAddingCategory(true);
                    } else {
                      setKategoriNama(e.target.value);
                    }
                  }}
                >
                  {kategori
                    .filter(k => k.statusAktif)
                    .map(k => (
                      <option key={k.id} value={k.namaKategori}>
                        {k.namaKategori}
                      </option>
                    ))}
                  <option value="__NEW__">+ Tambah Kategori Baru...</option>
                </select>
                <span className="material-symbols-outlined text-[20px] text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  arrow_drop_down
                </span>
              </div>
            </div>

            {/* Periode Hijriyah */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Periode Hijriyah
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-11 px-3 pr-9 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border appearance-none focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                  value={periodeLabel}
                  onChange={e => setPeriodeLabel(e.target.value)}
                >
                  {periode.map(p => (
                    <option key={p.id} value={p.labelPeriode}>
                      {p.labelPeriode} {p.statusAktif ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[20px] text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  calendar_month
                </span>
              </div>
            </div>

            {/* Tanggal Subsidi Masuk */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Tanggal Subsidi Masuk
              </label>
              <input
                type="date"
                className="w-full h-11 px-3 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                value={tanggalTransaksi}
                onChange={e => setTanggalTransaksi(e.target.value)}
                required
              />
            </div>

            {/* Nominal Subsidi */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Nominal Alokasi Subsidi
              </label>
              <div className="flex items-center rounded-xl bg-surface-subtle overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-forest-600/20 border border-border focus-within:border-forest-600 transition-all">
                <div className="px-3.5 h-12 flex items-center justify-center bg-forest-50 text-forest-800 font-bold text-sm border-r border-border flex-shrink-0">
                  Rp
                </div>
                <input
                  className="w-full h-12 px-3 bg-transparent text-ink-900 font-bold text-base sm:text-lg tabular-nums focus:outline-none text-left"
                  placeholder="0"
                  type="text"
                  value={nominal === 0 ? '' : formatNumber(nominal)}
                  onChange={e => setNominal(parseRupiah(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Catatan / Keterangan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Keterangan / Sumber Dana
              </label>
              <input
                type="text"
                className="w-full h-11 px-3 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                placeholder="Contoh: Subsidi Kas MMD Tahap I, Donasi alumni"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t border-border flex-shrink-0 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeSubsidyModal}
                disabled={saving}
                className="h-11 rounded-xl bg-surface-subtle hover:bg-neutral-200 text-ink-800 border border-border font-medium text-sm active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan Subsidi'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
