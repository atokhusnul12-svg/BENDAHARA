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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [pengeluaran, setPengeluaran] = useState<PengeluaranItem[]>([]);
  const [subsidi, setSubsidi] = useState<SubsidiItem[]>([]);
  const [periode, setPeriode] = useState<PeriodeItem[]>([]);
  const [kategori, setKategori] = useState<KategoriItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');

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

  const openSubsidyModal = (subs?: SubsidiItem) => {
    setSubsidyToEdit(subs || null);
    setIsSubsidyModalOpen(true);
  };

  const closeSubsidyModal = () => {
    setSubsidyToEdit(null);
    setIsSubsidyModalOpen(false);
  };

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedPeriode
        ? `/api/data?periode=${encodeURIComponent(selectedPeriode)}`
        : '/api/data';

      const res = await fetch(url);
      const json = await res.json();

      if (json.success && json.data) {
        setPengeluaran(json.data.pengeluaran || []);
        setSubsidi(json.data.subsidi || []);
        setPeriode(json.data.periode || []);
        setKategori(json.data.kategori || []);
        setSyncStatus(json.data.syncStatus || null);
        setSummary(json.data.summary || null);

        // Jika belum ada selectedPeriode, pilih periode yang aktif
        if (!selectedPeriode && json.data.periode && json.data.periode.length > 0) {
          const active = json.data.periode.find((p: PeriodeItem) => p.statusAktif);
          if (active) {
            setSelectedPeriode(active.labelPeriode);
          } else {
            setSelectedPeriode(json.data.periode[0].labelPeriode);
          }
        }
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriode]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
