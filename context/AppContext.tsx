'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  FinancialSummary,
  KategoriItem,
  PengeluaranInput,
  PengeluaranItem,
  PeriodeItem,
  SubsidiInput,
  SubsidiItem,
  SyncStatus,
} from '@/lib/types';
import { calculateFinancialSummary } from '@/lib/summary';

interface ToastState {
  show: boolean;
  title: string;
  subtitle?: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  loading: boolean;
  pengeluaran: PengeluaranItem[];
  subsidi: SubsidiItem[];
  periode: PeriodeItem[];
  kategori: KategoriItem[];
  syncStatus: SyncStatus | null;
  summary: FinancialSummary;
  selectedPeriode: string;
  setSelectedPeriode: (label: string) => void;
  refreshData: () => Promise<void>;
  toast: ToastState;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  // Admin Auth
  authLoading: boolean;
  isAdmin: boolean;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  verifyAdminPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  openPinModal: (onSuccess?: () => void) => void;
  closePinModal: () => void;
  // Modal Pengeluaran
  isExpenseModalOpen: boolean;
  expenseToEdit: PengeluaranItem | null;
  openExpenseModal: (expense?: PengeluaranItem) => void;
  closeExpenseModal: () => void;
  // Modal Subsidi
  isSubsidyModalOpen: boolean;
  subsidyToEdit: SubsidiItem | null;
  openSubsidyModal: (subsidy?: SubsidiItem) => void;
  closeSubsidyModal: () => void;
  removeSubsidiLocally: (id: string) => void;
  deleteRecord: (type: 'subsidi' | 'pengeluaran' | 'periode' | 'kategori', id: string) => Promise<boolean>;
  // Single Source of Truth CRUD Handlers
  addSubsidiRecord: (item: SubsidiInput) => Promise<SubsidiItem>;
  updateSubsidiRecord: (item: Partial<SubsidiItem> & { id: string }) => Promise<boolean>;
  addPengeluaranBatch: (items: PengeluaranInput[]) => Promise<PengeluaranItem[]>;
  updatePengeluaranRecord: (item: Partial<PengeluaranItem> & { id: string }) => Promise<boolean>;
  broadcastDataMutation: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  // Inisialisasi awal dari cache browser lokal (offline-first, Single Source of Truth)
  const [pengeluaran, setPengeluaran] = useState<PengeluaranItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const pendingStr = localStorage.getItem('mmd_pending_deleted_pengeluaran');
        const pending: string[] = pendingStr ? JSON.parse(pendingStr) : [];
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) {
          const list: PengeluaranItem[] = JSON.parse(cached).pengeluaran || [];
          return list.filter(p => !pending.includes(String(p.id).trim()));
        }
      } catch (e) {}
    }
    return [];
  });

  const [subsidi, setSubsidi] = useState<SubsidiItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const pendingStr = localStorage.getItem('mmd_pending_deleted_subsidi');
        const pending: string[] = pendingStr ? JSON.parse(pendingStr) : [];
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) {
          const list: SubsidiItem[] = JSON.parse(cached).subsidi || [];
          return list.filter(s => !pending.includes(String(s.id).trim()));
        }
      } catch (e) {}
    }
    return [];
  });

  const [periode, setPeriode] = useState<PeriodeItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) return JSON.parse(cached).periode || [];
      } catch (e) {}
    }
    return [];
  });

  const [kategori, setKategori] = useState<KategoriItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) return JSON.parse(cached).kategori || [];
      } catch (e) {}
    }
    return [];
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const [selectedPeriode, setSelectedPeriodeState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mmd_selected_periode');
        if (saved) return saved;
      } catch (e) {}
    }
    return '';
  });

  const setSelectedPeriode = useCallback((label: string) => {
    setSelectedPeriodeState(label);
    if (typeof window !== 'undefined') {
      try {
        if (label) {
          localStorage.setItem('mmd_selected_periode', label);
        } else {
          localStorage.removeItem('mmd_selected_periode');
        }
      } catch (e) {}
    }
  }, []);

  // Toast
  const [toast, setToast] = useState<ToastState>({
    show: false,
    title: '',
    subtitle: '',
    type: 'success',
  });

  const showToast = useCallback((title: string, subtitle?: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, title, subtitle, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  // Admin Auth State
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const pinSuccessCallbackRef = useRef<(() => void) | null>(null);
  const refreshDataRef = useRef<(() => Promise<void>) | null>(null);

  // Periksa status autentikasi admin ke server
  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth', {
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      setIsAdmin(Boolean(json.authenticated));
      return Boolean(json.authenticated);
    } catch {
      setIsAdmin(false);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Login Administrator menggunakan Username & Password
  const loginAdmin = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAdmin(true);
        showToast('Login Berhasil', 'Selamat datang di Buku Kas Bendahara MMD.');
        if (refreshDataRef.current) {
          refreshDataRef.current();
        }
        return { success: true };
      }
      return { success: false, error: json.error || 'Username atau Password salah.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menghubungi server.' };
    }
  }, [showToast]);

  const logoutAdmin = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      setIsAdmin(false);
      showToast('Keluar', 'Sesi Bendahara telah ditutup.', 'info');
    } catch {
      setIsAdmin(false);
    }
  }, [showToast]);

  // Backward compatible verifyAdminPin (maps to password authentication)
  const verifyAdminPin = useCallback(async (pin: string) => {
    return loginAdmin('MMD', pin);
  }, [loginAdmin]);

  // Stub openPinModal agar pemanggilan lama tidak menampilkan popup kode akses
  const openPinModal = useCallback((_onSuccess?: () => void) => {
    // Sengaja di-stub: kode akses popup ditiadakan sesuai instruksi pengguna
  }, []);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
  }, []);

  // Modal Pengeluaran
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<PengeluaranItem | null>(null);

  // Modal Subsidi
  const [isSubsidyModalOpen, setIsSubsidyModalOpen] = useState(false);
  const [subsidyToEdit, setSubsidyToEdit] = useState<SubsidiItem | null>(null);

  const openExpenseModal = (expense?: PengeluaranItem) => {
    setExpenseToEdit(expense || null);
    setIsExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(false);
  };

  const openSubsidyModal = (subs?: any) => {
    setSubsidyToEdit(subs || null);
    setIsSubsidyModalOpen(true);
  };

  const closeSubsidyModal = () => {
    setSubsidyToEdit(null);
    setIsSubsidyModalOpen(false);
  };

  /**
   * Simpan perubahan ke localStorage secara terpusat dengan versi skema
   */
  const saveToOfflineCache = (field: 'subsidi' | 'pengeluaran' | 'periode' | 'kategori', data: any) => {
    if (typeof window !== 'undefined') {
      try {
        const cachedStr = localStorage.getItem('mmd_offline_cache');
        const cached = cachedStr ? JSON.parse(cachedStr) : {};
        cached[field] = data;
        cached.schemaVersion = 1;
        cached.savedAt = new Date().toISOString();
        localStorage.setItem('mmd_offline_cache', JSON.stringify(cached));
      } catch (e) {
        console.error('[AppContext] Gagal menulis ke localStorage:', e);
      }
    }
  };

  /**
   * Broadcast mutasi data ke tab lain / perangkat yang sama
   */
  const broadcastDataMutation = useCallback(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('mmd_cross_device_sync');
        channel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
        channel.close();
      } catch (e) {}
    }
  }, []);

  /**
   * Single Source of Truth Summary:
   * Selalu dihitung ulang secara sinkron dan otomatis dari state lokal aktif.
   * Menampilkan Saldo Terkonfirmasi (Google Sheets) & Saldo Sementara.
   */
  const summary: FinancialSummary = useMemo(() => {
    return calculateFinancialSummary(
      pengeluaran,
      subsidi,
      kategori,
      selectedPeriode
    );
  }, [pengeluaran, subsidi, kategori, selectedPeriode]);

  /**
   * 1. TAMBAH SUBSIDI (Remote Write Confirmation Required)
   * Hanya berstatus sukses setelah Google Sheets benar-benar mengonfirmasi penyimpanan.
   */
  const addSubsidiRecord = useCallback(async (
    item: Omit<SubsidiItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SubsidiItem> => {
    const now = new Date().toISOString();
    // Unique Idempotency Key
    const id = 'SUB-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

    // Kirim langsung ke API server
    const res = await fetch('/api/subsidi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        id,
        nominal: Number(item.nominal) || 0,
        catatan: item.catatan || '',
        tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
        bulanHijriah: item.bulanHijriah || '',
        tahunHijriah: String(item.tahunHijriah || ''),
        periodeId: item.periodeId || '',
        kategoriId: item.kategoriId || '',
        kategoriNama: item.kategoriNama || '',
      }),
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid.' }));

    if (res.status === 401) {
      setIsAdmin(false);
      throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json?.error || 'Gagal menyimpan subsidi ke Google Sheets. Formulir tetap tersimpan.');
    }

    const isConfirmed = Boolean(json.remoteConfirmed);
    const newRecord: SubsidiItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
      nominal: Number(item.nominal) || 0,
      catatan: item.catatan || '',
      tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
      bulanHijriah: item.bulanHijriah || '',
      tahunHijriah: String(item.tahunHijriah || ''),
      periodeId: item.periodeId || '',
      kategoriId: item.kategoriId || '',
      kategoriNama: item.kategoriNama || '',
      syncStatus: isConfirmed ? ('synced' as const) : ('pending' as const),
    };

    // Tambahkan ke state & cache lokal
    setSubsidi(prev => {
      const updated = [newRecord, ...prev.filter(s => String(s.id).trim() !== id)];
      saveToOfflineCache('subsidi', updated);
      return updated;
    });

    if (isConfirmed) {
      showToast('Subsidi Berhasil Disimpan', 'Tersinkronisasi sempurna dengan Google Sheets.');
    } else {
      showToast('Subsidi Disimpan Sementara', 'Data tersimpan lokal, menunggu koneksi Google Sheets.', 'info');
    }
    broadcastDataMutation();
    return newRecord;
  }, [showToast, broadcastDataMutation]);

  /**
   * 2. UPDATE SUBSIDI
   */
  const updateSubsidiRecord = useCallback(async (
    item: Partial<SubsidiItem> & { id: string }
  ): Promise<boolean> => {
    const targetId = String(item.id).trim();
    const now = new Date().toISOString();

    const res = await fetch('/api/subsidi', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid.' }));

    if (res.status === 401) {
      setIsAdmin(false);
      throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json?.error || 'Gagal mengubah data subsidi di Google Sheets.');
    }

    const isConfirmed = Boolean(json.remoteConfirmed ?? true);
    setSubsidi(prev => {
      const updated = prev.map(s => {
        if (String(s.id).trim() === targetId) {
          return {
            ...s,
            ...item,
            nominal: item.nominal !== undefined ? Number(item.nominal) : s.nominal,
            updatedAt: now,
            syncStatus: (isConfirmed ? 'synced' : 'pending') as 'synced' | 'pending' | 'failed',
          };
        }
        return s;
      });
      saveToOfflineCache('subsidi', updated);
      return updated;
    });

    showToast('Subsidi Diperbarui', isConfirmed ? 'Perubahan tersinkron dengan Google Sheets.' : 'Perubahan tersimpan lokal.');
    broadcastDataMutation();
    return true;
  }, [showToast, broadcastDataMutation]);

  /**
   * 3. TAMBAH PENGELUARAN (Batch Multi-item, Remote Write Confirmation)
   */
  const addPengeluaranBatch = useCallback(async (
    items: Omit<PengeluaranItem, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<PengeluaranItem[]> => {
    const now = new Date().toISOString();
    const eventId = 'EVT-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const preparedItems = items.map((it, idx) => {
      const jumlah = Number(it.jumlah) || 1;
      const hargaSatuan = Number(it.hargaSatuan) || 0;
      const total = Number(it.total) || jumlah * hargaSatuan;
      return {
        ...it,
        id: 'EXP-' + Date.now().toString(36) + '-' + (idx + 1) + '-' + Math.random().toString(36).substring(2, 5),
        eventId: it.eventId || eventId,
        createdAt: now,
        updatedAt: now,
        jumlah,
        hargaSatuan,
        total,
        satuan: it.satuan || 'pcs',
        catatan: it.catatan || '',
        tanggalTransaksi: it.tanggalTransaksi || now.split('T')[0],
        bulanHijriah: it.bulanHijriah || '',
        tahunHijriah: String(it.tahunHijriah || ''),
        periodeId: it.periodeId || '',
        kategoriId: it.kategoriId || '',
        kategoriNama: it.kategoriNama || '',
      };
    });

    const res = await fetch('/api/pengeluaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: preparedItems }),
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid.' }));

    if (res.status === 401) {
      setIsAdmin(false);
      throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json?.error || 'Gagal menyimpan pengeluaran ke Google Sheets. Formulir tetap tersimpan.');
    }

    const isConfirmed = Boolean(json.remoteConfirmed);
    const finalItems: PengeluaranItem[] = preparedItems.map(p => ({
      ...p,
      syncStatus: (isConfirmed ? 'synced' : 'pending') as 'synced' | 'pending' | 'failed',
    }));

    // Simpan ke state lokal & cache
    setPengeluaran(prev => {
      const updated = [...finalItems, ...prev];
      saveToOfflineCache('pengeluaran', updated);
      return updated;
    });

    if (isConfirmed) {
      showToast('Pengeluaran Berhasil Disimpan', 'Tersinkronisasi sempurna dengan Google Sheets.');
    } else {
      showToast('Pengeluaran Disimpan Sementara', 'Data dicatat lokal, menunggu koneksi Google Sheets.', 'info');
    }
    broadcastDataMutation();
    return finalItems;
  }, [showToast, broadcastDataMutation]);

  /**
   * 4. UPDATE PENGELUARAN
   */
  const updatePengeluaranRecord = useCallback(async (
    item: Partial<PengeluaranItem> & { id: string }
  ): Promise<boolean> => {
    const targetId = String(item.id).trim();
    const now = new Date().toISOString();

    const res = await fetch('/api/pengeluaran', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid.' }));

    if (res.status === 401) {
      setIsAdmin(false);
      throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json?.error || 'Gagal mengubah data transaksi di Google Sheets.');
    }

    const isConfirmed = Boolean(json.remoteConfirmed ?? true);
    setPengeluaran(prev => {
      const updated = prev.map(p => {
        if (String(p.id).trim() === targetId) {
          const jumlah = item.jumlah !== undefined ? Number(item.jumlah) : p.jumlah;
          const hargaSatuan = item.hargaSatuan !== undefined ? Number(item.hargaSatuan) : p.hargaSatuan;
          const total = item.total !== undefined ? Number(item.total) : jumlah * hargaSatuan;
          return {
            ...p,
            ...item,
            jumlah,
            hargaSatuan,
            total,
            updatedAt: now,
            syncStatus: (isConfirmed ? 'synced' : 'pending') as 'synced' | 'pending' | 'failed',
          };
        }
        return p;
      });
      saveToOfflineCache('pengeluaran', updated);
      return updated;
    });

    showToast('Transaksi Diperbarui', isConfirmed ? 'Perubahan tersinkron dengan Google Sheets.' : 'Perubahan tersimpan lokal.');
    broadcastDataMutation();
    return true;
  }, [showToast, broadcastDataMutation]);

  /**
   * 5. HAPUS DATA SENTRAL (Remote Confirmation Required)
   * Jika penghapusan remote gagal, item TIDAK AKAN dihapus dari state lokal.
   */
  const deleteRecord = useCallback(async (
    type: 'subsidi' | 'pengeluaran' | 'periode' | 'kategori',
    id: string
  ): Promise<boolean> => {
    const targetId = String(id || '').trim();
    if (!targetId) {
      throw new Error(`ID ${type} tidak valid.`);
    }

    // 1. Kirim permintaan hapus ke server Google Sheets terlebih dahulu
    const res = await fetch(`/api/${type}?id=${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    const json = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid.' }));

    if (res.status === 401) {
      setIsAdmin(false);
      throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json?.error || `Gagal menghapus data dari Google Sheets. Data buku kas tetap aman.`);
    }

    // 2. Penghapusan remote berhasil terkonfirmasi:
    // Catat ke pending deleted agar tidak muncul kembali saat sync Sheets
    if (typeof window !== 'undefined') {
      try {
        const key = `mmd_pending_deleted_${type}`;
        const pStr = localStorage.getItem(key);
        const pList: string[] = pStr ? JSON.parse(pStr) : [];
        if (!pList.includes(targetId)) {
          pList.push(targetId);
          localStorage.setItem(key, JSON.stringify(pList));
        }
      } catch (e) {}
    }

    // 3. Hapus dari state lokal
    if (type === 'subsidi') {
      setSubsidi(prev => {
        const updated = prev.filter(s => String(s.id || '').trim() !== targetId);
        saveToOfflineCache('subsidi', updated);
        return updated;
      });
    } else if (type === 'pengeluaran') {
      setPengeluaran(prev => {
        const updated = prev.filter(p => String(p.id || '').trim() !== targetId);
        saveToOfflineCache('pengeluaran', updated);
        return updated;
      });
    } else if (type === 'periode') {
      setPeriode(prev => {
        const updated = prev.filter(p => String(p.id || '').trim() !== targetId);
        saveToOfflineCache('periode', updated);
        return updated;
      });
    } else if (type === 'kategori') {
      setKategori(prev => {
        const updated = prev.filter(k => String(k.id || '').trim() !== targetId);
        saveToOfflineCache('kategori', updated);
        return updated;
      });
    }

    broadcastDataMutation();
    return true;
  }, [broadcastDataMutation]);

  const removeSubsidiLocally = useCallback((id: string) => {
    deleteRecord('subsidi', id).catch(() => {});
  }, [deleteRecord]);

  /**
   * 6. SINKRONISASI DATA DARI SERVER (Refresh / Sync)
   * Menggabungkan remote data tanpa menimpa data lokal yang belum tersinkron,
   * dan tanpa membangkitkan kembali data yang sudah dihapus.
   */
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);

      const url = selectedPeriode
        ? `/api/data?periode=${encodeURIComponent(selectedPeriode)}&_t=${Date.now()}`
        : `/api/data?_t=${Date.now()}`;

      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.status === 401) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const json = await res.json();

      if (json.success && json.data) {
        let pendingSubsidiList: string[] = [];
        let pendingPengeluaranList: string[] = [];
        if (typeof window !== 'undefined') {
          try {
            const pSubStr = localStorage.getItem('mmd_pending_deleted_subsidi');
            if (pSubStr) pendingSubsidiList = JSON.parse(pSubStr);
            const pExpStr = localStorage.getItem('mmd_pending_deleted_pengeluaran');
            if (pExpStr) pendingPengeluaranList = JSON.parse(pExpStr);
          } catch (e) {}
        }

        // 1. Saring remote subsidi agar tidak ada item pending deleted
        const remoteSubsidi = (json.data.subsidi || []).filter(
          (s: any) => !pendingSubsidiList.includes(String(s.id || '').trim())
        );

        // 2. Gabungkan dengan item lokal yang baru ditambahkan (jangan sampai tertimpa)
        setSubsidi(prevLocal => {
          const merged = [...remoteSubsidi];
          for (const localItem of prevLocal) {
            const localId = String(localItem.id || '').trim();
            if (pendingSubsidiList.includes(localId)) continue;
            const existsInRemote = merged.some(r => String(r.id || '').trim() === localId);
            if (!existsInRemote) {
              merged.unshift(localItem);
            }
          }
          saveToOfflineCache('subsidi', merged);
          return merged;
        });

        // 3. Saring remote pengeluaran
        const remotePengeluaran = (json.data.pengeluaran || []).filter(
          (p: any) => !pendingPengeluaranList.includes(String(p.id || '').trim())
        );

        // 4. Gabungkan dengan item lokal
        setPengeluaran(prevLocal => {
          const merged = [...remotePengeluaran];
          for (const localItem of prevLocal) {
            const localId = String(localItem.id || '').trim();
            if (pendingPengeluaranList.includes(localId)) continue;
            const existsInRemote = merged.some(r => String(r.id || '').trim() === localId);
            if (!existsInRemote) {
              merged.unshift(localItem);
            }
          }
          saveToOfflineCache('pengeluaran', merged);
          return merged;
        });

        if (Array.isArray(json.data.periode)) {
          setPeriode(json.data.periode);
          saveToOfflineCache('periode', json.data.periode);
        }
        if (Array.isArray(json.data.kategori)) {
          setKategori(json.data.kategori);
          saveToOfflineCache('kategori', json.data.kategori);
        }

        setSyncStatus(json.data.syncStatus || null);

        // Pastikan selectedPeriode valid
        if (json.data.periode && json.data.periode.length > 0) {
          const currentValid = selectedPeriode && json.data.periode.some(
            (p: PeriodeItem) => p.labelPeriode.toLowerCase() === selectedPeriode.toLowerCase() || p.id === selectedPeriode
          );
          if (!currentValid) {
            const active = json.data.periode.find((p: PeriodeItem) => p.statusAktif);
            const fallback = active ? active.labelPeriode : json.data.periode[0].labelPeriode;
            setSelectedPeriode(fallback);
          }
        }
      }
    } catch (err) {
      console.warn('Gagal memuat data dari server, menggunakan cache offline:', err);
      setSyncStatus({
        connected: false,
        spreadsheetName: 'Cache Offline Browser',
        spreadsheetId: '-',
        lastSyncTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        error: 'Offline. Menggunakan data tersimpan di perangkat.',
        isLocalFallback: true,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPeriode, setSelectedPeriode]);

  useEffect(() => {
    refreshDataRef.current = refreshData;
    refreshData();
  }, [refreshData]);

  // 1. Sinkronisasi antar-tab di browser / HP yang sama via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel('mmd_cross_device_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'DATA_UPDATED') {
          refreshData();
        }
      };
      return () => {
        channel.close();
      };
    } catch (e) {}
  }, [refreshData]);

  // 2. Sinkronisasi otomatis saat pengguna membuka kembali tab / aplikasi HP (visibilitychange & focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData();
      }
    };
    const handleFocus = () => {
      refreshData();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshData]);

  // 3. Polling latar belakang periodik setiap 20 detik saat layar aktif/terbuka
  // Memastikan perubahan dari HP lain langsung terambil tanpa harus refresh manual
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Otomatis sinkronisasi ulang saat koneksi internet kembali pulih
  useEffect(() => {
    const handleOnline = () => {
      showToast('Koneksi Pulih', 'Menyinkronkan data dengan server...', 'info');
      refreshData();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshData, showToast]);

  // Auto-dismiss toast setelah 4 detik
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        hideToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show, hideToast]);

  return (
    <AppContext.Provider
      value={{
        loading,
        pengeluaran,
        subsidi,
        periode,
        kategori,
        syncStatus,
        summary,
        selectedPeriode,
        setSelectedPeriode,
        refreshData,
        toast,
        showToast,
        hideToast,
        authLoading,
        isAdmin,
        loginAdmin,
        logoutAdmin,
        verifyAdminPin,
        openPinModal,
        closePinModal,
        isExpenseModalOpen,
        expenseToEdit,
        openExpenseModal,
        closeExpenseModal,
        isSubsidyModalOpen,
        subsidyToEdit,
        openSubsidyModal,
        closeSubsidyModal,
        removeSubsidiLocally,
        deleteRecord,
        addSubsidiRecord,
        updateSubsidiRecord,
        addPengeluaranBatch,
        updatePengeluaranRecord,
        broadcastDataMutation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
