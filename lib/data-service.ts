import fs from 'fs';
import path from 'path';
import {
  AppDatabase,
  FinancialSummary,
  KategoriItem,
  PengeluaranItem,
  PeriodeItem,
  SubsidiItem,
  SyncStatus,
} from './types';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'bendahara_mmd.json');

// Default Kategori Awal sesuai Permintaan User
const DEFAULT_KATEGORI: KategoriItem[] = [
  {
    id: 'KAT-LBM',
    namaKategori: 'LBM (Lajnah Bahtsul Masail)',
    statusAktif: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iconName: 'menu_book',
  },
  {
    id: 'KAT-TFQ',
    namaKategori: 'Tafaquh & Mubahitsin',
    statusAktif: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iconName: 'groups',
  },
  {
    id: 'KAT-MSY',
    namaKategori: 'Musyawaroh',
    statusAktif: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iconName: 'forum',
  },
];

// Default Periode Awal
const DEFAULT_PERIODE: PeriodeItem[] = [
  {
    id: 'PER-1448-JU',
    namaBulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    labelPeriode: 'Jumadal Ula 1448 H',
    statusAktif: true,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Helper untuk pencocokan kategori yang fleksibel dan toleran
 * Mendukung pencocokan nama persis, ID, singkatan (misal: "LBM" vs "LBM (Lajnah Bahtsul Masail)"),
 * maupun case-insensitive.
 */
export function matchCategory(
  itemKat: string | undefined,
  kat: { namaKategori: string; id?: string }
): boolean {
  if (!itemKat) return false;
  const a = itemKat.trim().toLowerCase();
  const b = (kat.namaKategori || '').trim().toLowerCase();
  const id = (kat.id || '').trim().toLowerCase();

  if (a === b || (id && a === id)) return true;
  // Format singkatan di awal, misal "lbm" cocok dengan "lbm (lajnah bahtsul masail)"
  if (b.startsWith(a + ' ') || b.startsWith(a + '(') || a.startsWith(b + ' ')) return true;
  // Keyword khusus divisi pesantren MMD
  if (a.includes('lbm') && b.includes('lbm')) return true;
  if (a.includes('tafaquh') && b.includes('tafaquh')) return true;
  if (a.includes('musyawaroh') && b.includes('musyawaroh')) return true;
  return false;
}

/**
 * Memastikan direktori dan database lokal tersedia
 */
function ensureLocalDb(): AppDatabase {
  const dir = path.dirname(DATA_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE_PATH)) {
    const initialDb: AppDatabase = {
      pengeluaran: [],
      subsidi: [],
      periode: DEFAULT_PERIODE,
      kategori: DEFAULT_KATEGORI,
      config: {
        spreadsheetUrl: process.env.GOOGLE_SPREADSHEET_URL || '',
        scriptUrl: process.env.GOOGLE_SCRIPT_URL || '',
        scriptToken: process.env.GOOGLE_SCRIPT_TOKEN || 'mmd-amanah-kas-secret',
      },
    };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content) as AppDatabase;
    if (!parsed.pengeluaran) parsed.pengeluaran = [];
    if (!parsed.subsidi) parsed.subsidi = [];
    if (!parsed.periode || parsed.periode.length === 0) parsed.periode = [...DEFAULT_PERIODE];
    if (!parsed.kategori || parsed.kategori.length === 0) parsed.kategori = [...DEFAULT_KATEGORI];

    // Pastikan seluruh kategori bawaan selalu ada di list
    for (const defKat of DEFAULT_KATEGORI) {
      if (!parsed.kategori.some(k => matchCategory(k.namaKategori, defKat))) {
        parsed.kategori.unshift(defKat);
      }
    }
    for (const defPer of DEFAULT_PERIODE) {
      if (!parsed.periode.some(p => p.labelPeriode.toLowerCase() === defPer.labelPeriode.toLowerCase())) {
        parsed.periode.unshift(defPer);
      }
    }

    return parsed;
  } catch (err) {
    const fallback: AppDatabase = {
      pengeluaran: [],
      subsidi: [],
      periode: [...DEFAULT_PERIODE],
      kategori: [...DEFAULT_KATEGORI],
    };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveLocalDb(db: AppDatabase): void {
  const dir = path.dirname(DATA_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * Panggil Google Apps Script via HTTP POST
 */
async function callGoogleAppsScript(action: string, payloadData: any = {}): Promise<any> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  const token = process.env.GOOGLE_SCRIPT_TOKEN?.trim() || 'mmd-amanah-kas-secret';

  if (!scriptUrl || scriptUrl.length < 10) {
    return {
      success: false,
      isConfigured: false,
      error: 'URL Google Apps Script belum dikonfigurasi di file environment (.env.local).',
    };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action,
        ...payloadData,
      }),
      // Apps Script Web Apps sering me-redirect (302) ke script.googleusercontent.com
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        success: false,
        isConfigured: true,
        error: `Server Google Apps Script mengembalikan status HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json;
    } catch (parseError) {
      return {
        success: false,
        isConfigured: true,
        error: `Respons dari Google Apps Script bukan JSON yang valid: ${text.slice(0, 150)}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      isConfigured: true,
      error: `Gagal menghubungi Google Apps Script: ${err.message || String(err)}`,
    };
  }
}

/**
 * Cek Status Koneksi Google Sheets
 */
export async function checkSyncStatus(): Promise<SyncStatus> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  const spreadsheetUrl = process.env.GOOGLE_SPREADSHEET_URL?.trim() || '';
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (!scriptUrl) {
    return {
      connected: false,
      spreadsheetName: 'Belum Terhubung (Mode Lokal Aktif)',
      spreadsheetId: '-',
      lastSyncTime: now + ' WIB',
      error: 'Google Apps Script URL belum diisi di .env.local. Sistem saat ini berjalan dengan penyimpanan lokal terproteksi.',
      isLocalFallback: true,
    };
  }

  const result = await callGoogleAppsScript('ping');
  if (result.success) {
    return {
      connected: true,
      spreadsheetName: result.spreadsheetName || 'Buku_Kas_MMD_1448H',
      spreadsheetId: result.spreadsheetId || 'Tersinkron',
      lastSyncTime: now + ' WIB',
      isLocalFallback: false,
    };
  } else {
    return {
      connected: false,
      spreadsheetName: 'Koneksi Gagal',
      spreadsheetId: '-',
      lastSyncTime: now + ' WIB',
      error: result.error || 'Tidak dapat terhubung ke Google Sheets.',
      isLocalFallback: true,
    };
  }
}

/**
 * Mengambil Seluruh Data (Sinkron dengan GSheets jika online, fallback lokal)
 */
export async function getAllData(): Promise<{
  pengeluaran: PengeluaranItem[];
  subsidi: SubsidiItem[];
  periode: PeriodeItem[];
  kategori: KategoriItem[];
  syncStatus: SyncStatus;
}> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  const localDb = ensureLocalDb();

  if (scriptUrl) {
    const remote = await callGoogleAppsScript('getData');
    if (remote.success) {
      // Sinkronkan data dari Google Sheets ke penyimpanan lokal sebagai cache
      if (Array.isArray(remote.pengeluaran)) {
        localDb.pengeluaran = remote.pengeluaran.map((p: any) => ({
          ...p,
          id: String(p.id || ''),
          eventId: String(p.eventId || ''),
          bulanHijriah: String(p.bulanHijriah || ''),
          tahunHijriah: String(p.tahunHijriah || ''),
          periodeId: String(p.periodeId || ''),
          kategoriId: String(p.kategoriId || ''),
          kategoriNama: String(p.kategoriNama || ''),
          jenisAcara: String(p.jenisAcara || ''),
          namaBarang: String(p.namaBarang || ''),
          satuan: String(p.satuan || 'pcs'),
          catatan: p.catatan ? String(p.catatan) : '',
          jumlah: Number(p.jumlah) || 1,
          hargaSatuan: Number(p.hargaSatuan) || 0,
          total: Number(p.total) || ((Number(p.jumlah) || 1) * (Number(p.hargaSatuan) || 0)),
          tanggalTransaksi: p.tanggalTransaksi ? String(p.tanggalTransaksi).split('T')[0] : '',
        }));
      }

      if (Array.isArray(remote.subsidi)) {
        localDb.subsidi = remote.subsidi.map((s: any) => ({
          ...s,
          id: String(s.id || ''),
          bulanHijriah: String(s.bulanHijriah || ''),
          tahunHijriah: String(s.tahunHijriah || ''),
          periodeId: String(s.periodeId || ''),
          kategoriId: String(s.kategoriId || ''),
          kategoriNama: String(s.kategoriNama || ''),
          catatan: s.catatan ? String(s.catatan) : '',
          nominal: Number(s.nominal) || 0,
          tanggalTransaksi: s.tanggalTransaksi ? String(s.tanggalTransaksi).split('T')[0] : '',
        }));
      }

      if (Array.isArray(remote.periode)) {
        const remotePers = remote.periode.map((per: any) => ({
          ...per,
          id: String(per.id || ''),
          namaBulanHijriah: String(per.namaBulanHijriah || ''),
          tahunHijriah: String(per.tahunHijriah || ''),
          labelPeriode: String(per.labelPeriode || ''),
          statusAktif: Boolean(per.statusAktif),
        }));

        const mergedPeriode = [...remotePers];
        for (const defPer of DEFAULT_PERIODE) {
          if (!mergedPeriode.some(p => p.labelPeriode.toLowerCase() === defPer.labelPeriode.toLowerCase())) {
            mergedPeriode.unshift(defPer);
            callGoogleAppsScript('createPeriode', { data: defPer }).catch(() => {});
          }
        }
        localDb.periode = mergedPeriode;
      }

      if (Array.isArray(remote.kategori)) {
        const remoteKats = remote.kategori.map((kat: any) => ({
          ...kat,
          id: String(kat.id || ''),
          namaKategori: String(kat.namaKategori || ''),
          statusAktif: kat.statusAktif !== undefined ? Boolean(kat.statusAktif) : true,
        }));

        const mergedKategori = [...remoteKats];
        for (const defKat of DEFAULT_KATEGORI) {
          if (!mergedKategori.some(k => matchCategory(k.namaKategori, defKat))) {
            mergedKategori.unshift(defKat);
            callGoogleAppsScript('createKategori', { data: defKat }).catch(() => {});
          }
        }
        localDb.kategori = mergedKategori;
      }

      saveLocalDb(localDb);

      return {
        pengeluaran: localDb.pengeluaran,
        subsidi: localDb.subsidi,
        periode: localDb.periode,
        kategori: localDb.kategori,
        syncStatus: {
          connected: true,
          spreadsheetName: 'Tersambung Google Sheets',
          spreadsheetId: 'Online',
          lastSyncTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
          isLocalFallback: false,
        },
      };
    } else {
      // Remote call failed
      return {
        pengeluaran: localDb.pengeluaran,
        subsidi: localDb.subsidi,
        periode: localDb.periode,
        kategori: localDb.kategori,
        syncStatus: {
          connected: false,
          spreadsheetName: 'Koneksi Google Sheets Terputus',
          spreadsheetId: '-',
          lastSyncTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
          error: remote.error || 'Gagal memuat data dari Google Sheets.',
          isLocalFallback: true,
        },
      };
    }
  }

  // Gunakan data lokal
  return {
    pengeluaran: localDb.pengeluaran,
    subsidi: localDb.subsidi,
    periode: localDb.periode,
    kategori: localDb.kategori,
    syncStatus: {
      connected: false,
      spreadsheetName: 'Penyimpanan Lokal Aktif',
      spreadsheetId: '-',
      lastSyncTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
      error: 'Google Apps Script belum dikonfigurasi. Menggunakan penyimpanan data lokal.',
      isLocalFallback: true,
    },
  };
}

/**
 * Hitung Ringkasan Finansial untuk Periode & Kategori tertentu
 * Sesuai aturan Prompt:
 * - Saldo tersisa = total subsidi masuk − total pengeluaran
 * - Persentase penggunaan = total pengeluaran ÷ total subsidi masuk × 100%
 * - Jika total subsidi adalah nol, persentase 0% (tanpa error division by zero)
 */
export function calculateSummary(
  pengeluaran: PengeluaranItem[],
  subsidi: SubsidiItem[],
  kategoriList: KategoriItem[],
  filterPeriodeLabel?: string,
  filterKategoriNama?: string
): FinancialSummary {
  const isAllPeriods = !filterPeriodeLabel || filterPeriodeLabel === 'Semua' || filterPeriodeLabel === 'Semua Periode';
  const isAllCategories = !filterKategoriNama || filterKategoriNama === 'Semua';

  const matchPeriod = (item: { bulanHijriah?: string; tahunHijriah?: string; periodeId?: string }) => {
    if (isAllPeriods) return true;
    const target = filterPeriodeLabel?.trim().toLowerCase();
    const label = `${item.bulanHijriah || ''} ${item.tahunHijriah || ''} H`.trim().toLowerCase();
    const pid = (item.periodeId || '').trim().toLowerCase();
    return label === target || pid === target;
  };

  // Filter berdasarkan periode
  let filteredPengeluaran = pengeluaran.filter(matchPeriod);
  let filteredSubsidi = subsidi.filter(matchPeriod);

  // Filter opsional berdasarkan kategori tunggal
  if (!isAllCategories) {
    const dummyKat = { namaKategori: filterKategoriNama || '', id: filterKategoriNama || '' };
    filteredPengeluaran = filteredPengeluaran.filter(
      p => matchCategory(p.kategoriNama, dummyKat) || matchCategory(p.kategoriId, dummyKat)
    );
    filteredSubsidi = filteredSubsidi.filter(
      s => matchCategory(s.kategoriNama, dummyKat) || matchCategory(s.kategoriId, dummyKat)
    );
  }

  const totalPengeluaran = filteredPengeluaran.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalSubsidi = filteredSubsidi.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
  const saldoTersisa = totalSubsidi - totalPengeluaran;

  const persentasePenggunaan = totalSubsidi > 0
    ? Math.round((totalPengeluaran / totalSubsidi) * 1000) / 10
    : 0;

  // Breakdown per Kategori
  const categorySummaries = kategoriList
    .filter(k => k.statusAktif)
    .map(kat => {
      const katPengeluaran = pengeluaran.filter(p => {
        const matchesPeriod = matchPeriod(p);
        const matchesKat = matchCategory(p.kategoriNama, kat) || matchCategory(p.kategoriId, kat);
        return matchesPeriod && matchesKat;
      });

      const katSubsidi = subsidi.filter(s => {
        const matchesPeriod = matchPeriod(s);
        const matchesKat = matchCategory(s.kategoriNama, kat) || matchCategory(s.kategoriId, kat);
        return matchesPeriod && matchesKat;
      });

      const totalKeluar = katPengeluaran.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const totalSub = katSubsidi.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
      const sisa = totalSub - totalKeluar;
      const pct = totalSub > 0 ? Math.round((totalKeluar / totalSub) * 1000) / 10 : 0;

      return {
        kategoriId: kat.id,
        kategoriNama: kat.namaKategori,
        totalSubsidi: totalSub,
        totalPengeluaran: totalKeluar,
        saldoTersisa: sisa,
        persentasePenggunaan: pct,
        jumlahTransaksi: katPengeluaran.length,
      };
    });

  return {
    periodeLabel: filterPeriodeLabel || 'Semua Periode',
    totalSubsidi,
    totalPengeluaran,
    saldoTersisa,
    persentasePenggunaan,
    jumlahTransaksi: filteredPengeluaran.length,
    categories: categorySummaries,
  };
}

/**
 * 1. Tambah Pengeluaran (Mendukung Batch Multi-item dari 1 acara)
 */
export async function addPengeluaran(items: Omit<PengeluaranItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<{
  success: boolean;
  data?: PengeluaranItem[];
  error?: string;
}> {
  const now = new Date().toISOString();
  const eventId = 'EVT-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const localDb = ensureLocalDb();
  const preparedItems: PengeluaranItem[] = items.map((item, index) => {
    const jumlah = Number(item.jumlah) || 1;
    const hargaSatuan = Number(item.hargaSatuan) || 0;
    const total = Number(item.total) || jumlah * hargaSatuan;

    const matchedKat = localDb.kategori.find(k => matchCategory(item.kategoriNama, k) || matchCategory(item.kategoriId, k));
    const kategoriId = item.kategoriId || matchedKat?.id || '';
    const kategoriNama = matchedKat?.namaKategori || item.kategoriNama || '';

    return {
      id: 'EXP-' + Date.now().toString(36) + '-' + (index + 1) + '-' + Math.random().toString(36).substring(2, 5),
      eventId: item.eventId || eventId,
      createdAt: now,
      updatedAt: now,
      tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
      periodeId: item.periodeId || '',
      bulanHijriah: item.bulanHijriah || '',
      tahunHijriah: item.tahunHijriah || '',
      kategoriId,
      kategoriNama,
      jenisAcara: item.jenisAcara || '',
      namaBarang: item.namaBarang || '',
      jumlah,
      satuan: item.satuan || 'pcs',
      hargaSatuan,
      total,
      catatan: item.catatan || '',
    };
  });

  // Jika terhubung dengan Google Apps Script, kirim ke sana
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createPengeluaran', { data: preparedItems });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menyimpan transaksi ke Google Sheets.' };
    }
  }

  // Simpan ke local db
  localDb.pengeluaran.unshift(...preparedItems);
  saveLocalDb(localDb);

  return { success: true, data: preparedItems };
}

/**
 * 2. Update Pengeluaran
 */
export async function updatePengeluaran(item: Partial<PengeluaranItem> & { id: string }): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!item.id) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  let remoteUpdated = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updatePengeluaran', { data: item });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal memperbarui transaksi di Google Sheets.' };
    }
    remoteUpdated = true;
  }

  const localDb = ensureLocalDb();
  const idx = localDb.pengeluaran.findIndex(p => p.id === item.id);
  if (idx !== -1) {
    const old = localDb.pengeluaran[idx];
    const jumlah = item.jumlah !== undefined ? Number(item.jumlah) : old.jumlah;
    const hargaSatuan = item.hargaSatuan !== undefined ? Number(item.hargaSatuan) : old.hargaSatuan;
    const total = jumlah * hargaSatuan;

    localDb.pengeluaran[idx] = {
      ...old,
      ...item,
      jumlah,
      hargaSatuan,
      total,
      updatedAt: new Date().toISOString(),
    };
    saveLocalDb(localDb);
    return { success: true };
  }

  if (remoteUpdated) {
    return { success: true };
  }

  return { success: false, error: 'Transaksi tidak ditemukan.' };
}

/**
 * 3. Hapus Pengeluaran
 */
export async function deletePengeluaran(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!id) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  let remoteDeleted = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deletePengeluaran', { id });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menghapus transaksi dari Google Sheets.' };
    }
    remoteDeleted = true;
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.pengeluaran.length;
  localDb.pengeluaran = localDb.pengeluaran.filter(p => p.id !== id);
  const localDeleted = localDb.pengeluaran.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    return { success: true };
  }

  return { success: false, error: 'Transaksi tidak ditemukan.' };
}

/**
 * 4. Tambah Subsidi
 */
export async function addSubsidi(item: Omit<SubsidiItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
  success: boolean;
  data?: SubsidiItem;
  error?: string;
}> {
  const now = new Date().toISOString();
  const localDb = ensureLocalDb();
  const matchedKat = localDb.kategori.find(k => matchCategory(item.kategoriNama, k) || matchCategory(item.kategoriId, k));
  const kategoriId = item.kategoriId || matchedKat?.id || '';
  const kategoriNama = matchedKat?.namaKategori || item.kategoriNama || '';

  const prepared: SubsidiItem = {
    id: 'SUB-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
    createdAt: now,
    updatedAt: now,
    tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
    periodeId: item.periodeId || '',
    bulanHijriah: item.bulanHijriah || '',
    tahunHijriah: item.tahunHijriah ? String(item.tahunHijriah) : '',
    kategoriId,
    kategoriNama,
    nominal: Number(item.nominal) || 0,
    catatan: item.catatan || '',
  };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createSubsidi', { data: prepared });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menyimpan subsidi ke Google Sheets.' };
    }
  }

  localDb.subsidi.unshift(prepared);
  saveLocalDb(localDb);

  return { success: true, data: prepared };
}

/**
 * 5. Update Subsidi
 */
export async function updateSubsidi(item: Partial<SubsidiItem> & { id: string }): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!item.id) return { success: false, error: 'ID subsidi wajib ada.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  let remoteUpdated = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updateSubsidi', { data: item });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal mengubah subsidi di Google Sheets.' };
    }
    remoteUpdated = true;
  }

  const localDb = ensureLocalDb();
  const idx = localDb.subsidi.findIndex(s => s.id === item.id);
  if (idx !== -1) {
    const old = localDb.subsidi[idx];
    localDb.subsidi[idx] = {
      ...old,
      ...item,
      nominal: item.nominal !== undefined ? Number(item.nominal) : old.nominal,
      updatedAt: new Date().toISOString(),
    };
    saveLocalDb(localDb);
    return { success: true };
  }

  if (remoteUpdated) {
    return { success: true };
  }

  return { success: false, error: 'Subsidi tidak ditemukan.' };
}

/**
 * 6. Hapus Subsidi
 */
export async function deleteSubsidi(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!id) return { success: false, error: 'ID subsidi wajib ada.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  let remoteDeleted = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deleteSubsidi', { id });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menghapus subsidi dari Google Sheets.' };
    }
    remoteDeleted = true;
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.subsidi.length;
  localDb.subsidi = localDb.subsidi.filter(s => s.id !== id);
  const localDeleted = localDb.subsidi.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    return { success: true };
  }

  return { success: false, error: 'Catatan subsidi tidak ditemukan.' };
}

/**
 * 7. Tambah Periode (dengan Validasi Duplikat)
 */
export async function addPeriode(data: {
  namaBulanHijriah: string;
  tahunHijriah: string;
  statusAktif?: boolean;
}): Promise<{
  success: boolean;
  data?: PeriodeItem;
  error?: string;
}> {
  const bulan = (data.namaBulanHijriah || '').trim();
  const tahun = (data.tahunHijriah || '').toString().trim();
  const label = `${bulan} ${tahun} H`;

  if (!bulan || !tahun) {
    return { success: false, error: 'Bulan dan tahun Hijriyah wajib diisi.' };
  }

  const localDb = ensureLocalDb();
  const isDuplicate = localDb.periode.some(
    p => p.labelPeriode.toLowerCase() === label.toLowerCase()
  );

  if (isDuplicate) {
    return {
      success: false,
      error: `Periode "${label}" sudah ada sebelumnya. Silakan gunakan periode yang sudah dibuat atau masukkan bulan/tahun lain.`,
    };
  }

  const statusAktif = data.statusAktif ?? false;
  if (statusAktif) {
    localDb.periode.forEach(p => (p.statusAktif = false));
  }

  const newPeriode: PeriodeItem = {
    id: 'PER-' + Date.now().toString(36),
    namaBulanHijriah: bulan,
    tahunHijriah: tahun,
    labelPeriode: label,
    statusAktif,
    createdAt: new Date().toISOString(),
  };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createPeriode', { data: newPeriode });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menambahkan periode ke Google Sheets.' };
    }
  }

  localDb.periode.push(newPeriode);
  saveLocalDb(localDb);

  return { success: true, data: newPeriode };
}

/**
 * 8. Set Periode Aktif
 */
export async function setActivePeriode(id: string): Promise<{ success: boolean; error?: string }> {
  const localDb = ensureLocalDb();
  const target = localDb.periode.find(p => p.id === id);
  if (!target) return { success: false, error: 'Periode tidak ditemukan.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updatePeriode', { data: { id, statusAktif: true } });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal mengubah periode aktif di Google Sheets.' };
    }
  }

  localDb.periode.forEach(p => {
    p.statusAktif = p.id === id;
  });

  saveLocalDb(localDb);
  return { success: true };
}

/**
 * 9. Kelola Kategori (Tambah & Edit)
 */
export async function addKategori(namaKategori: string): Promise<{
  success: boolean;
  data?: KategoriItem;
  error?: string;
}> {
  const name = namaKategori.trim();
  if (!name) return { success: false, error: 'Nama kategori wajib diisi.' };

  const localDb = ensureLocalDb();
  if (localDb.kategori.some(k => k.namaKategori.toLowerCase() === name.toLowerCase())) {
    return { success: false, error: `Kategori "${name}" sudah terdaftar.` };
  }

  const newKat: KategoriItem = {
    id: 'KAT-' + Date.now().toString(36),
    namaKategori: name,
    statusAktif: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iconName: 'account_balance',
  };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createKategori', { data: newKat });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal menyimpan kategori ke Google Sheets.' };
    }
  }

  localDb.kategori.push(newKat);
  saveLocalDb(localDb);
  return { success: true, data: newKat };
}

export async function updateKategori(item: { id: string; namaKategori?: string; statusAktif?: boolean }): Promise<{
  success: boolean;
  error?: string;
}> {
  const localDb = ensureLocalDb();
  const kat = localDb.kategori.find(k => k.id === item.id);
  if (!kat) return { success: false, error: 'Kategori tidak ditemukan.' };

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updateKategori', { data: item });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal mengubah kategori di Google Sheets.' };
    }
  }

  if (item.namaKategori !== undefined) kat.namaKategori = item.namaKategori.trim();
  if (item.statusAktif !== undefined) kat.statusAktif = item.statusAktif;
  kat.updatedAt = new Date().toISOString();

  saveLocalDb(localDb);
  return { success: true };
}
