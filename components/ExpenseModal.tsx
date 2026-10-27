'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    showToast,
    summary,
    pengeluaran,
    subsidi,
    refreshData,
    addPengeluaranBatch,
    updatePengeluaranRecord,
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

  // Keyboard shortcut Escape untuk menutup modal & body scroll lock
  useEffect(() => {
    if (!isExpenseModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpenseModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpenseModalOpen, closeExpenseModal]);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (!isExpenseModalOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = expenseToEdit
      ? (expenseToEdit.id ? `edit-${expenseToEdit.id}` : `create-${expenseToEdit.kategoriNama || 'card'}`)
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

    if (expenseToEdit && expenseToEdit.id) {
      // Edit existing single item
      setKategoriNama(expenseToEdit.kategoriNama);
      const matchedPer = (expenseToEdit.bulanHijriah + ' ' + expenseToEdit.tahunHijriah + ' H').trim();
      setPeriodeLabel(matchedPer || currentSelectedPeriode);
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
        currentKategori.find(k => k.statusAktif)?.namaKategori ||
        (currentKategori[0]?.namaKategori ?? 'LBM (Lajnah Bahtsul Masail)');
      setKategoriNama(defaultKat);
      setPeriodeLabel(currentSelectedPeriode || (currentPeriode[0]?.labelPeriode ?? 'Jumadal Ula 1448 H'));
      setTanggalTransaksi(today);
      setJenisAcara('');
      setCatatan('');
      setItems([createDefaultRow()]);
    }
  }, [isExpenseModalOpen, expenseToEdit]);

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
        await updatePengeluaranRecord({
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
        });
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

        await addPengeluaranBatch(payloadItems);
        closeExpenseModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeExpenseModal();
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
                {expenseToEdit ? 'edit_note' : 'add_circle'}
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg text-ink-900 font-bold tracking-tight">
                {expenseToEdit ? 'Edit Transaksi Pengeluaran' : 'Catat Pengeluaran Baru'}
              </h2>
              <span className="text-xs text-ink-500 font-medium">
                Bendahara MMD • Pesantren MMD
              </span>
            </div>
          </div>
          <button
            onClick={closeExpenseModal}
            className="w-8 h-8 rounded-full bg-surface-subtle text-ink-500 hover:text-ink-900 hover:bg-neutral-200 flex items-center justify-center active:scale-95 transition-all"
            type="button"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 flex flex-col gap-4">
            {/* Error Alert if any */}
            {errorMessage && (
              <div className="bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-200 flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in">
                <span className="material-symbols-outlined text-[20px] text-red-600 flex-shrink-0">
                  error
                </span>
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* 1. Jenis Acara / Kegiatan (Paling Atas) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-800">
                Jenis Acara / Kegiatan
              </label>
              <div className="relative w-full">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-[19px]">event_note</span>
                </div>
                <input
                  className="w-full h-11 pl-11 pr-3 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border placeholder:text-ink-400 focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                  placeholder="Contoh: Pengajian Umum, Kegiatan LBM, Takziran"
                  type="text"
                  value={jenisAcara}
                  onChange={e => setJenisAcara(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 2. Rincian Belanja (Tepat di Bawah Jenis Acara) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-800">
                  Rincian Belanja
                </label>
                <span className="text-[11px] text-ink-500 font-medium">
                  {items.length} Rincian
                </span>
              </div>

              {items.map((item, idx) => (
                <div
                  key={item.rowId}
                  className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border flex flex-col gap-2.5 relative"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
                    <span className="text-xs font-bold text-forest-800">
                      Rincian {items.length > 1 ? `#${idx + 1}` : '1'}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 active:scale-95 transition-colors"
                        title="Hapus rincian ini"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        <span>Hapus Rincian</span>
                      </button>
                    )}
                  </div>

                  {/* Nama Barang */}
                  <div className="relative w-full">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                    </div>
                    <input
                      className="w-full h-10 pl-9 pr-3 rounded-lg bg-white font-medium text-xs sm:text-sm text-ink-900 border border-border placeholder:text-ink-400 focus:outline-none focus:border-forest-600 focus:ring-1 focus:ring-forest-600 transition-all"
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
                      <span className="text-[11px] text-ink-500 font-medium">Jumlah</span>
                      <div className="h-10 bg-white rounded-lg px-1 flex items-center justify-between border border-border">
                        <button
                          aria-label="Kurangi"
                          className="w-7 h-7 rounded bg-surface-subtle hover:bg-neutral-200 text-ink-800 flex items-center justify-center active:scale-90 transition-transform"
                          onClick={() => adjustQty(idx, -1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                        <input
                          className="w-10 text-center bg-transparent tabular-nums text-xs sm:text-sm text-ink-900 font-bold focus:outline-none"
                          min="1"
                          type="number"
                          value={item.jumlah}
                          onChange={e => handleItemChange(idx, 'jumlah', e.target.value)}
                        />
                        <button
                          aria-label="Tambah"
                          className="w-7 h-7 rounded bg-forest-600 hover:bg-forest-700 text-white flex items-center justify-center active:scale-90 transition-transform shadow-xs"
                          onClick={() => adjustQty(idx, 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    </div>

                    {/* Satuan */}
                    <div className="col-span-3 flex flex-col gap-1">
                      <span className="text-[11px] text-ink-500 font-medium">Satuan</span>
                      <select
                        className="w-full h-10 px-2 rounded-lg bg-white text-ink-900 text-xs appearance-none focus:outline-none border border-border focus:border-forest-600 font-medium"
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
                      <span className="text-[11px] text-ink-500 font-medium">
                        Harga Satuan (Rp)
                      </span>
                      <input
                        className="w-full h-10 px-2 rounded-lg bg-white text-ink-900 tabular-nums text-xs font-bold focus:outline-none border border-border focus:border-forest-600 text-right"
                        placeholder="0"
                        type="text"
                        value={item.hargaSatuan === 0 ? '' : formatNumber(item.hargaSatuan)}
                        onChange={e => handleItemChange(idx, 'hargaSatuan', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Subtotal baris */}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/60 text-ink-500">
                    <span>
                      Subtotal: <span className="tabular-nums font-semibold text-ink-700">{item.jumlah}</span> {item.satuan} × {formatRupiah(item.hargaSatuan)}
                    </span>
                    <span className="font-bold tabular-nums text-forest-700">{formatRupiah(item.total)}</span>
                  </div>
                </div>
              ))}

              {!expenseToEdit && (
                <button
                  type="button"
                  onClick={addItemRow}
                  className="w-full h-11 rounded-xl border border-dashed border-forest-600/40 hover:border-forest-600 bg-forest-50/50 hover:bg-forest-50 text-forest-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-all mt-1"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Tambah Rincian Belanja</span>
                </button>
              )}
            </div>

            {/* 3. Kategori Pos Anggaran */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Kategori Pos Anggaran
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
                    placeholder="Nama pos/kategori baru..."
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
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-700 flex items-center pointer-events-none">
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    account_balance
                  </span>
                </div>
                <select
                  className="w-full h-11 pl-11 pr-9 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border appearance-none focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
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

            {/* 4. Periode Hijriyah & Tanggal side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Periode Hijriyah
                </label>
                <div className="relative w-full">
                  <select
                    className="w-full h-11 px-3 pr-8 rounded-xl bg-surface-subtle font-medium text-xs text-ink-900 border border-border appearance-none focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all truncate"
                    value={periodeLabel}
                    onChange={e => setPeriodeLabel(e.target.value)}
                  >
                    {periode.map(p => (
                      <option key={p.id} value={p.labelPeriode}>
                        {p.labelPeriode} {p.statusAktif ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-ink-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    calendar_month
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  className="w-full h-11 px-3 rounded-xl bg-surface-subtle font-medium text-xs text-ink-900 border border-border focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                  value={tanggalTransaksi}
                  onChange={e => setTanggalTransaksi(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 5. Total Pengeluaran Acara (Read-only Calculated) */}
            <div className="bg-forest-50/70 rounded-xl p-4 flex flex-col gap-1 border border-forest-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-forest-800">
                  Total Seluruh Pengeluaran
                </span>
                <span className="text-[11px] bg-forest-100 text-forest-800 px-2.5 py-0.5 rounded-full font-semibold">
                  Otomatis
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl text-forest-800 font-bold tracking-tight tabular-nums">
                  {formatRupiah(grandTotal)}
                </span>
                <span
                  className="material-symbols-outlined text-[22px] text-forest-700"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  calculate
                </span>
              </div>
            </div>

            {/* 6. Live Simulation Box (Simulasi Saldo Sebelum Simpan) */}
            <div className="bg-white rounded-xl p-3.5 border border-border shadow-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-600 font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-forest-700">
                    account_balance_wallet
                  </span>
                  Simulasi Saldo Kas {kategoriNama}
                </span>
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
                  Estimasi Sisa
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="flex flex-col">
                  <span className="text-ink-500">Saldo Saat Ini</span>
                  <span className="font-bold tabular-nums text-ink-900">
                    {formatRupiah(currentCategoryBalance)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-ink-500">Sisa Setelah Transaksi</span>
                  <span
                    className={`font-bold tabular-nums ${
                      simulatedRemainingBalance < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatRupiah(simulatedRemainingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Catatan Tambahan (Opsional) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                className="w-full h-10 px-3 rounded-xl bg-surface-subtle font-medium text-xs sm:text-sm text-ink-900 border border-border focus:outline-none focus:bg-white focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 transition-all"
                placeholder="Contoh: Titipan santri, kuitansi terlampir"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons Sticky Footer */}
          <div className="p-4 border-t border-border flex-shrink-0 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeExpenseModal}
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
                    <span>{expenseToEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</span>
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
