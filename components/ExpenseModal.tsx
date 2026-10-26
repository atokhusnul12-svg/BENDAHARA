'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatNumber, formatRupiah, parseRupiah } from '@/lib/format';

interface ExpenseItemRow {
  rowId: string;
  namaBarang: string;
  jumlah: number | string;
  satuan: string;
  hargaSatuan: number;
  total: number;
}

const createDefaultRow = (): ExpenseItemRow => ({
  rowId: 'row-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
  namaBarang: '',
  jumlah: 1,
  satuan: 'bungkus',
  hargaSatuan: 0,
  total: 0,
});

export default function ExpenseModal() {
  const {
    isExpenseModalOpen,
    expenseToEdit,
    closeExpenseModal,
    kategori,
    periode,
    selectedPeriode,
    refreshData,
    showToast,
    summary,
    pengeluaran,
    subsidi,
  } = useApp();

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [kategoriNama, setKategoriNama] = useState('');
  const [periodeLabel, setPeriodeLabel] = useState('');
  const [tanggalTransaksi, setTanggalTransaksi] = useState('');
  const [jenisAcara, setJenisAcara] = useState('');
  const [catatan, setCatatan] = useState('');

  // Quick category creation state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Multi-item rows (supports single or multiple items in one event)
  const [items, setItems] = useState<ExpenseItemRow[]>([createDefaultRow()]);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (!isExpenseModalOpen) return;

    setErrorMessage('');
    setIsAddingCategory(false);
    setNewCategoryName('');
    const today = new Date().toISOString().split('T')[0];

    if (expenseToEdit && expenseToEdit.id) {
      // Edit existing single item
      setKategoriNama(expenseToEdit.kategoriNama);
      const matchedPer = (expenseToEdit.bulanHijriah + ' ' + expenseToEdit.tahunHijriah + ' H').trim();
      setPeriodeLabel(matchedPer || selectedPeriode);
      const rawDate = expenseToEdit.tanggalTransaksi;
      setTanggalTransaksi(rawDate ? String(rawDate).split('T')[0] : today);
      setJenisAcara(expenseToEdit.jenisAcara);
      setCatatan(expenseToEdit.catatan || '');
      setItems([
        {
          rowId: 'row-edit-' + expenseToEdit.id,
          namaBarang: expenseToEdit.namaBarang,
          jumlah: Number(expenseToEdit.jumlah) || 1,
          satuan: expenseToEdit.satuan || 'bungkus',
          hargaSatuan: Number(expenseToEdit.hargaSatuan) || 0,
          total: Number(expenseToEdit.total) || 0,
        },
      ]);
    } else {
      // Add new (bisa dengan kategori default dari card)
      const defaultKat =
        expenseToEdit?.kategoriNama ||
        kategori.find(k => k.statusAktif)?.namaKategori ||
        (kategori[0]?.namaKategori ?? 'LBM (Lajnah Bahtsul Masail)');
      setKategoriNama(defaultKat);
      setPeriodeLabel(selectedPeriode || (periode[0]?.labelPeriode ?? 'Jumadal Ula 1448 H'));
      setTanggalTransaksi(today);
      setJenisAcara('');
      setCatatan('');
      setItems([createDefaultRow()]);
    }
  }, [isExpenseModalOpen, expenseToEdit, kategori, periode, selectedPeriode]);

  if (!isExpenseModalOpen) return null;

  // Handler for item row updates
  const handleItemChange = (index: number, field: keyof ExpenseItemRow, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'jumlah') {
        target.jumlah = val === '' ? '' : val;
        const numQty = Number(val) || 0;
        target.total = numQty * target.hargaSatuan;
      } else if (field === 'hargaSatuan') {
        const price = parseRupiah(val);
        target.hargaSatuan = price;
        const numQty = Number(target.jumlah) || 0;
        target.total = numQty * price;
      } else {
        (target as any)[field] = val;
      }

      copy[index] = target;
      return copy;
    });
  };

  const adjustQty = (index: number, delta: number) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const current = Math.max(1, Math.floor(Number(target.jumlah) || 1));
      const newQty = Math.max(1, current + delta);
      target.jumlah = newQty;
      target.total = newQty * target.hargaSatuan;
      copy[index] = target;
      return copy;
    });
  };

  const addItemRow = () => {
    setItems(prev => [...prev, createDefaultRow()]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Grand total for this event
  const grandTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  // Perhitungan simulasi saldo tersisa untuk kategori dan periode yang dipilih
  const currentCategorySubsidi = subsidi
    .filter(s => {
      const matchPeriod = (s.bulanHijriah + ' ' + s.tahunHijriah + ' H').trim().toLowerCase() === periodeLabel.trim().toLowerCase() || s.periodeId === periodeLabel;
      const matchKat = s.kategoriNama === kategoriNama || s.kategoriId === kategoriNama;
      return matchPeriod && matchKat;
    })
    .reduce((sum, s) => sum + (Number(s.nominal) || 0), 0);

  const currentCategoryExpense = pengeluaran
    .filter(p => {
      const matchPeriod = (p.bulanHijriah + ' ' + p.tahunHijriah + ' H').trim().toLowerCase() === periodeLabel.trim().toLowerCase() || p.periodeId === periodeLabel;
      const matchKat = p.kategoriNama === kategoriNama || p.kategoriId === kategoriNama;
      // Jika mode edit, kecualikan transaksi yang sedang diedit dari pengurangan lama
      const notBeingEdited = !expenseToEdit || p.id !== expenseToEdit.id;
      return matchPeriod && matchKat && notBeingEdited;
    })
    .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  const currentCategoryBalance = currentCategorySubsidi - currentCategoryExpense;
  const simulatedRemainingBalance = currentCategoryBalance - grandTotal;

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

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Mencegah submit berulang kali
    setErrorMessage('');

    if (!kategoriNama) {
      setErrorMessage('Kategori kegiatan wajib dipilih.');
      return;
    }
    if (!jenisAcara.trim()) {
      setErrorMessage('Jenis acara wajib diisi (contoh: Kegiatan LBM, Takziran).');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.namaBarang.trim()) {
        setErrorMessage(`Nama barang pada baris ke-${i + 1} wajib diisi.`);
        return;
      }
      const qtyNum = Number(item.jumlah);
      if (!item.jumlah || isNaN(qtyNum) || qtyNum <= 0) {
        setErrorMessage(`Jumlah barang pada baris ke-${i + 1} harus berupa angka lebih dari nol.`);
        return;
      }
      if (item.hargaSatuan < 0) {
        setErrorMessage(`Harga satuan pada baris ke-${i + 1} tidak boleh negatif.`);
        return;
      }
    }

    // Ambil info bulan dan tahun dari master periode yang dipilih
    const matchedPeriode = periode.find(
      p => p.labelPeriode.trim().toLowerCase() === periodeLabel.trim().toLowerCase() || p.id === periodeLabel
    );
    const bulanH = matchedPeriode ? matchedPeriode.namaBulanHijriah : (periodeLabel.split(' ')[0] || 'Jumadal Ula');
    const tahunH = matchedPeriode ? String(matchedPeriode.tahunHijriah) : '1448';
    const periodeId = matchedPeriode ? matchedPeriode.id : periodeLabel;
    const matchedKategori = kategori.find(k => k.namaKategori === kategoriNama);

    setSaving(true);
    try {
      if (expenseToEdit && expenseToEdit.id) {
        // Mode Edit (Single Row)
        const singleItem = items[0];
        const res = await fetch('/api/pengeluaran', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: expenseToEdit.id,
            kategoriNama,
            kategoriId: matchedKategori?.id || '',
            bulanHijriah: bulanH,
            tahunHijriah: tahunH,
            periodeId,
            tanggalTransaksi,
            jenisAcara: jenisAcara.trim(),
            namaBarang: singleItem.namaBarang.trim(),
            jumlah: Number(singleItem.jumlah) || 1,
            satuan: singleItem.satuan,
            hargaSatuan: singleItem.hargaSatuan,
            total: (Number(singleItem.jumlah) || 1) * singleItem.hargaSatuan,
            catatan: catatan.trim(),
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Gagal mengubah transaksi pengeluaran.');
        }

        await refreshData();
        showToast('Transaksi berhasil diperbarui', json.message || 'Tersimpan dengan sukses');
        closeExpenseModal();
      } else {
        // Mode Tambah Baru (Mendukung Multi-item batch)
        const payloadItems = items.map(item => ({
          kategoriNama,
          kategoriId: matchedKategori?.id || '',
          bulanHijriah: bulanH,
          tahunHijriah: tahunH,
          periodeId,
          tanggalTransaksi,
          jenisAcara: jenisAcara.trim(),
          namaBarang: item.namaBarang.trim(),
          jumlah: Number(item.jumlah) || 1,
          satuan: item.satuan,
          hargaSatuan: item.hargaSatuan,
          total: (Number(item.jumlah) || 1) * item.hargaSatuan,
          catatan: catatan.trim(),
        }));

        const res = await fetch('/api/pengeluaran', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payloadItems }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Gagal menyimpan transaksi ke Google Sheets.');
        }

        await refreshData();
        showToast('Pengeluaran berhasil disimpan', json.message || 'Tersimpan dengan sukses');
        closeExpenseModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-md shadow-2xl flex flex-col gap-space-md max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-1 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[24px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {expenseToEdit ? 'edit_note' : 'add_circle'}
            </span>
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {expenseToEdit ? 'Edit Transaksi Pengeluaran' : 'Tambah Pengeluaran'}
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Bendahara MMD • Pesantren MMD
              </span>
            </div>
          </div>
          <button
            onClick={closeExpenseModal}
            className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center active:scale-95 transition-all"
            type="button"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="bg-error-container text-on-error-container p-3 rounded-xl flex items-center gap-2 text-body-sm">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0">
              error
            </span>
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          {/* 1. Kategori Kegiatan */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-lg text-label-lg text-on-surface font-semibold">
                1. Kategori Kegiatan
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
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary flex items-center pointer-events-none">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance
                </span>
              </div>
              <select
                className="w-full h-12 pl-10 pr-9 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
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

          {/* 2. Periode & Tanggal side-by-side */}
          <div className="grid grid-cols-2 gap-space-sm">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-label-lg text-on-surface font-semibold">
                Periode Hijriyah
              </label>
              <div className="relative w-full">
                <select
                  className="w-full h-12 px-3 pr-8 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all text-xs font-medium truncate"
                  value={periodeLabel}
                  onChange={e => setPeriodeLabel(e.target.value)}
                >
                  {periode.map(p => (
                    <option key={p.id} value={p.labelPeriode}>
                      {p.labelPeriode} {p.statusAktif ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  calendar_month
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-label-lg text-on-surface font-semibold">
                Tanggal
              </label>
              <input
                type="date"
                className="w-full h-12 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium text-xs"
                value={tanggalTransaksi}
                onChange={e => setTanggalTransaksi(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 3. Jenis Acara */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-lg text-label-lg text-on-surface font-semibold">
              2. Jenis Acara / Kegiatan
            </label>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-[19px]">event_note</span>
              </div>
              <input
                className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all font-medium"
                placeholder="Contoh: Kegiatan LBM, Takziran, Pengajian"
                type="text"
                value={jenisAcara}
                onChange={e => setJenisAcara(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 4. Rincian Barang (Daftar Barang Belanja) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-label-lg text-label-lg text-on-surface font-semibold">
                3. Rincian Belanja Barang
              </label>
              {!expenseToEdit && (
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center gap-1 text-primary hover:text-primary-container font-label-sm text-label-sm font-semibold active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>+ Tambah Rincian</span>
                </button>
              )}
            </div>

            {items.map((item, idx) => (
              <div
                key={item.rowId}
                className="p-3 rounded-xl bg-surface-container-low/60 border border-surface-container flex flex-col gap-2.5 relative"
              >
                {items.length > 1 && (
                  <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                    <span className="font-label-sm text-label-sm font-semibold text-primary">
                      Barang #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="text-error hover:text-error-container p-0.5"
                      title="Hapus baris ini"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                )}

                {/* Nama Barang */}
                <div className="relative w-full">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                  </div>
                  <input
                    className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                    placeholder="Contoh: Rokok Surya 16, Konsumsi Snack, Kertas"
                    type="text"
                    value={item.namaBarang}
                    onChange={e => handleItemChange(idx, 'namaBarang', e.target.value)}
                    required
                  />
                </div>

                {/* Jumlah & Satuan & Harga Satuan Grid */}
                <div className="grid grid-cols-12 gap-2">
                  {/* Stepper Jumlah */}
                  <div className="col-span-5 flex flex-col gap-1">
                    <span className="text-[11px] text-on-surface-variant font-medium">Jumlah</span>
                    <div className="h-10 bg-surface-container-lowest rounded-lg px-1 flex items-center justify-between border border-surface-container">
                      <button
                        aria-label="Kurangi"
                        className="w-7 h-7 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center active:scale-90 transition-transform"
                        onClick={() => adjustQty(idx, -1)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <input
                        className="w-10 text-center bg-transparent font-title-currency-md text-sm text-on-surface font-bold focus:outline-none"
                        min="1"
                        type="number"
                        value={item.jumlah}
                        onChange={e => handleItemChange(idx, 'jumlah', e.target.value)}
                      />
                      <button
                        aria-label="Tambah"
                        className="w-7 h-7 rounded bg-primary text-on-primary flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                        onClick={() => adjustQty(idx, 1)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                  </div>

                  {/* Satuan */}
                  <div className="col-span-3 flex flex-col gap-1">
                    <span className="text-[11px] text-on-surface-variant font-medium">Satuan</span>
                    <select
                      className="w-full h-10 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-xs appearance-none focus:outline-none border border-surface-container"
                      value={item.satuan}
                      onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                    >
                      <option value="bungkus">bungkus</option>
                      <option value="pcs">pcs</option>
                      <option value="pack">pack</option>
                      <option value="dus">dus</option>
                      <option value="kg">kg</option>
                      <option value="porsi">porsi</option>
                      <option value="lembar">lembar</option>
                    </select>
                  </div>

                  {/* Harga Satuan */}
                  <div className="col-span-4 flex flex-col gap-1">
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      Harga (Rp)
                    </span>
                    <input
                      className="w-full h-10 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-title-currency-md text-xs font-bold focus:outline-none border border-surface-container text-right"
                      placeholder="0"
                      type="text"
                      value={item.hargaSatuan === 0 ? '' : formatNumber(item.hargaSatuan)}
                      onChange={e => handleItemChange(idx, 'hargaSatuan', e.target.value)}
                    />
                  </div>
                </div>

                {/* Subtotal baris */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-container/60 text-on-surface-variant">
                  <span>
                    Subtotal: {item.jumlah} {item.satuan} × {formatRupiah(item.hargaSatuan)}
                  </span>
                  <span className="font-bold text-primary">{formatRupiah(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Total Pengeluaran Acara (Read-only Calculated) */}
          <div className="bg-primary/5 rounded-xl p-space-md flex flex-col gap-1 border border-primary/10">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                Total Seluruh Pengeluaran
              </span>
              <span className="font-label-sm text-label-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                Dihitung Otomatis
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
                {formatRupiah(grandTotal)}
              </span>
              <span
                className="material-symbols-outlined text-[22px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                calculate
              </span>
            </div>
          </div>

          {/* 6. Live Simulation Box (Simulasi Saldo Sebelum Simpan) */}
          <div className="bg-surface-container-lowest rounded-xl p-3 border border-surface-container shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  account_balance_wallet
                </span>
                Simulasi Saldo Kas {kategoriNama}
              </span>
              <span className="text-[10px] bg-secondary-fixed/50 text-on-secondary-fixed px-2 py-0.5 rounded-full font-bold">
                Estimasi Sementara
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="flex flex-col">
                <span className="text-on-surface-variant">Saldo Saat Ini</span>
                <span className="font-bold text-on-surface">
                  {formatRupiah(currentCategoryBalance)}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-on-surface-variant">Sisa Setelah Transaksi</span>
                <span
                  className={`font-bold ${
                    simulatedRemainingBalance < 0 ? 'text-error' : 'text-tertiary'
                  }`}
                >
                  {formatRupiah(simulatedRemainingBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25 transition-all"
              placeholder="Contoh: Titipan santri, kuitansi terlampir"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-space-sm pt-2">
            <button
              type="button"
              onClick={closeExpenseModal}
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
                  <span>{expenseToEdit ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
