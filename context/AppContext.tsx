'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  FinancialSummary,
  KategoriItem,
  PengeluaranItem,
  PeriodeItem,
  SubsidiItem,
  SyncStatus,
} from '@/lib/types';

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
  summary: FinancialSummary | null;
  selectedPeriode: string;
  setSelectedPeriode: (label: string) => void;
  refreshData: () => Promise<void>;
  toast: ToastState;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  // Inisialisasi awal dari cache browser lokal (offline-first)
  const [pengeluaran, setPengeluaran] = useState<PengeluaranItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) return JSON.parse(cached).pengeluaran || [];
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
  const [summary, setSummary] = useState<FinancialSummary | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mmd_offline_cache');
        if (cached) return JSON.parse(cached).summary || null;
      } catch (e) {}
    }
    return null;
  });

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

  // Modal Pengeluaran
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<PengeluaranItem | null>(null);

  // Modal Subsidi
  const [isSubsidyModalOpen, setIsSubsidyModalOpen] = useState(false);
  const [subsidyToEdit, setSubsidyToEdit] = useState<SubsidiItem | null>(null);

  const showToast = useCallback((title: string, subtitle?: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, title, subtitle, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

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

  const removeSubsidiLocally = useCallback((id: string) => {
    const targetId = String(id || '').trim();
    if (!targetId) return;

    if (typeof window !== 'undefined') {
      try {
        const pendingStr = localStorage.getItem('mmd_pending_deleted_subsidi');
        const pending: string[] = pendingStr ? JSON.parse(pendingStr) : [];
        if (!pending.includes(targetId)) {
          pending.push(targetId);
          localStorage.setItem('mmd_pending_deleted_subsidi', JSON.stringify(pending));
        }
      } catch (e) {}
    }

    setSubsidi(prev => {
      const deletedItem = prev.find(s => String(s.id || '').trim() === targetId);
      const updated = prev.filter(s => String(s.id || '').trim() !== targetId);

      if (deletedItem) {
        const nominal = Number(deletedItem.nominal) || 0;
        setSummary(prevSum => {
          if (!prevSum) return null;
          const newTotalSub = Math.max(0, prevSum.totalSubsidi - nominal);
          const newSaldo = newTotalSub - prevSum.totalPengeluaran;
          const newPct = newTotalSub > 0 ? Math.round((prevSum.totalPengeluaran / newTotalSub) * 1000) / 10 : 0;
          return {
            ...prevSum,
            totalSubsidi: newTotalSub,
            saldoTersisa: newSaldo,
            persentasePenggunaan: newPct,
            categories: (prevSum.categories || []).map(cat => {
              if (
                cat.kategoriNama === deletedItem.kategoriNama ||
                cat.kategoriId === deletedItem.kategoriId
              ) {
                const sub = Math.max(0, cat.totalSubsidi - nominal);
                const sisa = sub - cat.totalPengeluaran;
                const pct = sub > 0 ? Math.round((cat.totalPengeluaran / sub) * 1000) / 10 : 0;
                return {
                  ...cat,
                  totalSubsidi: sub,
                  saldoTersisa: sisa,
                  persentasePenggunaan: pct,
                };
              }
              return cat;
            }),
          };
        });
      }

      if (typeof window !== 'undefined') {
        try {
          const cachedStr = localStorage.getItem('mmd_offline_cache');
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            cached.subsidi = updated;
            localStorage.setItem('mmd_offline_cache', JSON.stringify(cached));
          }
        } catch (e) {}
      }
      return updated;
    });
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);

      // Sinkronkan pending deleted subsidi jika ada
      if (typeof window !== 'undefined') {
        try {
          const pendingStr = localStorage.getItem('mmd_pending_deleted_subsidi');
          const pending: string[] = pendingStr ? JSON.parse(pendingStr) : [];
          if (pending.length > 0) {
            for (const pid of pending) {
              fetch(`/api/subsidi?id=${encodeURIComponent(pid)}`, { method: 'DELETE' }).catch(() => {});
            }
          }
        } catch (e) {}
      }

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
      const json = await res.json();

      if (json.success && json.data) {
        let pendingList: string[] = [];
        if (typeof window !== 'undefined') {
          try {
            const pStr = localStorage.getItem('mmd_pending_deleted_subsidi');
            if (pStr) pendingList = JSON.parse(pStr);
          } catch (e) {}
        }

        const cleanSubsidi = (json.data.subsidi || []).filter(
          (s: any) => !pendingList.includes(String(s.id || '').trim())
        );

        setPengeluaran(json.data.pengeluaran || []);
        setSubsidi(cleanSubsidi);
        setPeriode(json.data.periode || []);
        setKategori(json.data.kategori || []);
        setSyncStatus(json.data.syncStatus || null);
        setSummary(json.data.summary || null);

        // Simpan ke offline cache browser (localStorage)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mmd_offline_cache', JSON.stringify({
              pengeluaran: json.data.pengeluaran || [],
              subsidi: cleanSubsidi,
              periode: json.data.periode || [],
              kategori: json.data.kategori || [],
              summary: json.data.summary || null,
              savedAt: new Date().toISOString(),
            }));
          } catch (e) {}
        }

        // Jika belum ada periode yang dipilih atau periode tidak ada lagi di daftar, gunakan periode aktif
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
      console.error('Gagal memuat data dari server, beralih ke cache offline:', err);
      // Fallback ke cache offline browser
      if (typeof window !== 'undefined') {
        try {
          const cachedStr = localStorage.getItem('mmd_offline_cache');
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            setPengeluaran(cached.pengeluaran || []);
            setSubsidi(cached.subsidi || []);
            setPeriode(cached.periode || []);
            setKategori(cached.kategori || []);
            setSummary(cached.summary || null);
            setSyncStatus({
              connected: false,
              spreadsheetName: 'Cache Offline Browser',
              spreadsheetId: '-',
              lastSyncTime: cached.savedAt ? new Date(cached.savedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'Offline',
              error: 'Tidak dapat tersambung ke server. Menampilkan data dari cache lokal browser.',
              isLocalFallback: true,
            });
          }
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPeriode, setSelectedPeriode]);

  useEffect(() => {
    refreshData();
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
        isExpenseModalOpen,
        expenseToEdit,
        openExpenseModal,
        closeExpenseModal,
        isSubsidyModalOpen,
        subsidyToEdit,
        openSubsidyModal,
        closeSubsidyModal,
        removeSubsidiLocally,
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
