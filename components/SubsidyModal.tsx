'use client';

import React, { useState, useEffect } from 'react';
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
    refreshData,
    showToast,
  } = useApp();

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [kategoriNama, setKategoriNama] = useState('');
  const [periodeLabel, setPeriodeLabel] = useState('');
  const [tanggalTransaksi, setTanggalTransaksi] = useState('');
  const [nominal, setNominal] = useState(0);
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (!isSubsidyModalOpen) return;

    setErrorMessage('');
    const today = new Date().toISOString().split('T')[0];

    if (subsidyToEdit) {
      setKategoriNama(subsidyToEdit.kategoriNama);
      const matchedPer = (subsidyToEdit.bulanHijriah + ' ' + subsidyToEdit.tahunHijriah + ' H').trim();
      setPeriodeLabel(matchedPer || selectedPeriode);
      setTanggalTransaksi(subsidyToEdit.tanggalTransaksi || today);
      setNominal(Number(subsidyToEdit.nominal) || 0);
      setCatatan(subsidyToEdit.catatan || '');
    } else {
      const defaultKat = kategori.find(k => k.statusAktif)?.namaKategori || (kategori[0]?.namaKategori ?? 'LBM');
      setKategoriNama(defaultKat);
      setPeriodeLabel(selectedPeriode || (periode[0]?.labelPeriode ?? 'Jumadal Ula 1448 H'));
      setTanggalTransaksi(today);
      setNominal(0);
      setCatatan('');
    }
  }, [isSubsidyModalOpen, subsidyToEdit, kategori, periode, selectedPeriode]);

  if (!isSubsidyModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!kategoriNama) {
      setErrorMessage('Kategori kegiatan wajib dipilih.');
      return;
    }
    if (nominal <= 0) {
      setErrorMessage('Nominal subsidi harus lebih besar dari Rp 0.');
      return;
    }

    const parts = periodeLabel.trim().split(' ');
    const tahunH = parts.length >= 2 ? parts[parts.length - 2] : '1448';
    const bulanH = parts.slice(0, -2).join(' ') || (parts[0] ?? 'Jumadal Ula');
    const matchedKategori = kategori.find(k => k.namaKategori === kategoriNama);

    setSaving(true);
    try {
      if (subsidyToEdit) {
        const res = await fetch('/api/subsidi', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: subsidyToEdit.id,
            kategoriNama,
            kategoriId: matchedKategori?.id || '',
            bulanHijriah: bulanH,
            tahunHijriah: tahunH,
            periodeId: periodeLabel,
            tanggalTransaksi,
            nominal,
            catatan,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal mengubah catatan subsidi.');

        await refreshData();
        showToast('Catatan subsidi berhasil diubah', 'Google Sheets tersinkronisasi');
        closeSubsidyModal();
      } else {
        const res = await fetch('/api/subsidi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategoriNama,
            kategoriId: matchedKategori?.id || '',
            bulanHijriah: bulanH,
            tahunHijriah: tahunH,
            periodeId: periodeLabel,
            tanggalTransaksi,
            nominal,
            catatan,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal menyimpan penambahan subsidi.');

        await refreshData();
        showToast('Subsidi berhasil ditambahkan', 'Alokasi kas berhasil tersimpan di Google Sheets');
        closeSubsidyModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan subsidi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-md shadow-2xl flex flex-col gap-space-md max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between pb-1 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[24px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              volunteer_activism
            </span>
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {subsidyToEdit ? 'Edit Alokasi Subsidi' : 'Tambah Subsidi Kas'}
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
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="bg-error-container text-on-error-container p-3 rounded-xl flex items-center gap-2 text-body-sm">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0">
              error
            </span>
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          {/* Kategori Divisi */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Kategori Divisi
            </label>
            <div className="relative w-full">
              <select
                className="w-full h-12 px-3 pr-8 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
                value={kategoriNama}
                onChange={e => setKategoriNama(e.target.value)}
              >
                {kategori
                  .filter(k => k.statusAktif)
                  .map(k => (
                    <option key={k.id} value={k.namaKategori}>
                      {k.namaKategori}
                    </option>
                  ))}
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
                value={formatNumber(nominal)}
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

          <div className="grid grid-cols-2 gap-space-sm pt-2">
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
                  <span>{subsidyToEdit ? 'Simpan Perubahan' : 'Simpan Subsidi'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
