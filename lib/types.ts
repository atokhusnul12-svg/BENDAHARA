export interface PengeluaranItem {
  id: string;
  eventId: string;
  createdAt: string;
  updatedAt: string;
  tanggalTransaksi: string;
  periodeId: string;
  bulanHijriah: string;
  tahunHijriah: string;
  kategoriId: string;
  kategoriNama: string;
  jenisAcara: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  total: number;
  catatan?: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export interface SubsidiItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  tanggalTransaksi: string;
  periodeId: string;
  bulanHijriah: string;
  tahunHijriah: string;
  kategoriId: string;
  kategoriNama: string;
  nominal: number;
  catatan?: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export interface PeriodeItem {
  id: string;
  namaBulanHijriah: string;
  tahunHijriah: string;
  labelPeriode: string;
  statusAktif: boolean;
  createdAt: string;
}

export interface KategoriItem {
  id: string;
  namaKategori: string;
  statusAktif: boolean;
  createdAt: string;
  updatedAt: string;
  iconName?: string;
}

export interface SyncStatus {
  connected: boolean;
  spreadsheetName: string;
  spreadsheetId: string;
  lastSyncTime: string;
  error?: string;
  isLocalFallback?: boolean;
}

export interface CategorySummary {
  kategoriId: string;
  kategoriNama: string;
  totalSubsidi: number;
  totalPengeluaran: number;
  saldoTersisa: number;
  persentasePenggunaan: number;
  jumlahTransaksi: number;
}

export interface FinancialSummary {
  periodeLabel: string;
  totalSubsidi: number;
  totalPengeluaran: number;
  saldoTersisa: number;
  persentasePenggunaan: number;
  jumlahTransaksi: number;
  categories: CategorySummary[];
  totalSubsidiTerkonfirmasi: number;
  totalPengeluaranTerkonfirmasi: number;
  saldoTerkonfirmasi: number;
  hasPendingSync: boolean;
  pendingCount: number;
}

export type PengeluaranInput = Omit<PengeluaranItem, 'id' | 'createdAt' | 'updatedAt' | 'eventId'> & {
  id?: string;
  eventId?: string;
};

export type SubsidiInput = Omit<SubsidiItem, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export interface AppDatabase {
  pengeluaran: PengeluaranItem[];
  subsidi: SubsidiItem[];
  periode: PeriodeItem[];
  kategori: KategoriItem[];
  config?: {
    spreadsheetUrl?: string;
  };
}

