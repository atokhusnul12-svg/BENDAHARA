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
      className="fixed inset-0 z-[100] bg-inverse-surface/40 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 overscroll-contain"
    >
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-space-md py-space-sm border-b border-surface-container flex-shrink-0 bg-surface-container-lowest">

          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[24px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              volunteer_activism
            </span>
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {isEditMode ? 'Edit Alokasi Subsidi' : 'Tambah Subsidi Kas'}
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Bendahara MMD • Alokasi Amanah
              </span>
            </div>
          </div>
          <button
            onClick={closeSubsidyModal}
            className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center active:scale-95 transition-all"
            type="button"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain p-space-md flex flex-col gap-space-md">
            {errorMessage && (
              <div className="bg-error-container text-on-error-container p-3 rounded-xl flex items-center gap-2 text-body-sm">
                <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0">
                  error
                </span>
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Kategori Divisi */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                Kategori Divisi
              </label>
              <button
                type="button"
                onClick={() => setIsAddingCategory(prev => !prev)}
                className="text-primary hover:text-primary-container font-label-sm text-xs font-semibold flex items-center gap-0.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isAddingCategory ? 'close' : 'add'}
                </span>
                <span>{isAddingCategory ? 'Batal' : '+ Kategori Baru'}</span>
              </button>
            </div>

            {isAddingCategory && (
              <div className="flex items-center gap-2 p-2 bg-surface-container rounded-xl border border-primary/20 animate-in fade-in duration-200">
                <input
                  type="text"
                  placeholder="Nama divisi/kategori baru..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-xs border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
                <button
                  type="button"
                  disabled={creatingCategory || !newCategoryName.trim()}
                  onClick={handleQuickCreateCategory}
                  className="h-9 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  <span>{creatingCategory ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            )}

            <div className="relative w-full">
              <select
                className="w-full h-12 px-3 pr-8 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
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
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>

          {/* Periode Hijriyah */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Periode Hijriyah
            </label>
            <div className="relative w-full">
              <select
                className="w-full h-12 px-3 pr-8 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
                value={periodeLabel}
                onChange={e => setPeriodeLabel(e.target.value)}
              >
                {periode.map(p => (
                  <option key={p.id} value={p.labelPeriode}>
                    {p.labelPeriode} {p.statusAktif ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                calendar_month
              </span>
            </div>
          </div>

          {/* Tanggal Subsidi Masuk */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Tanggal Subsidi Masuk
            </label>
            <input
              type="date"
              className="w-full h-12 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
              value={tanggalTransaksi}
              onChange={e => setTanggalTransaksi(e.target.value)}
              required
            />
          </div>

          {/* Nominal Subsidi */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Nominal Subsidi
            </label>
            <div className="flex items-center rounded-xl bg-surface-container-low overflow-hidden focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/25 border border-surface-container">
              <div className="px-3.5 h-12 flex items-center justify-center bg-surface-container text-primary font-bold font-label-lg text-label-lg flex-shrink-0">
                Rp
              </div>
              <input
                className="w-full h-12 px-3 bg-transparent text-on-surface font-title-currency-md text-title-currency-md font-bold focus:outline-none text-left"
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
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Keterangan / Sumber Dana
            </label>
            <input
              type="text"
              className="w-full h-12 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all"
              placeholder="Contoh: Subsidi Kas MMD Tahap I, Donasi alumni"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
            />
            </div>
          </div>

          <div className="p-space-md border-t border-surface-container flex-shrink-0 bg-surface-container-lowest pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-space-sm">
              <button
                type="button"
                onClick={closeSubsidyModal}
                disabled={saving}
                className="h-12 rounded-xl bg-surface-container text-on-surface font-label-lg text-label-lg active:scale-95 transition-all font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 font-semibold disabled:opacity-60"
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
