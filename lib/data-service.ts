import {
  AppDatabase,
  FinancialSummary,
  KategoriItem,
  PengeluaranInput,
  PengeluaranItem,
  PeriodeItem,
  SubsidiInput,
  SubsidiItem,
  SyncStatus,
} from './types';
import { calculateFinancialSummary } from './summary';
import { syncFromPublishedCsv, CsvParsedResult } from './csv-importer';



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
 * Mendeteksi apakah aplikasi sedang berjalan di lingkungan serverless atau production
 * (misal Vercel, AWS Lambda) di mana filesystem bersifat read-only.
 */
function isServerlessOrProd(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    (process.env.NODE_ENV === 'production' && !process.env.MMD_ALLOW_LOCAL_FS)
  );
}

// In-Memory Database Singleton (Zero Filesystem Dependency for Vercel Serverless)
let inMemoryDb: AppDatabase = {
  pengeluaran: [],
  subsidi: [],
  periode: [...DEFAULT_PERIODE],
  kategori: [...DEFAULT_KATEGORI],
  config: {
    spreadsheetUrl: process.env.GOOGLE_SPREADSHEET_URL || '',
  },
};

// Set penanda ID yang dihapus (mencegah resurrection dari Sheets sebelum sinkronisasi tuntas)
const pendingDeletedSubsidiIds = new Set<string>();
const pendingDeletedPengeluaranIds = new Set<string>();
const pendingDeletedKategoriIds = new Set<string>();
const pendingDeletedPeriodeIds = new Set<string>();

/**
 * Reset memory DB khusus untuk pengujian otomatis (test runner)
 */
export function resetLocalDbForTesting(): void {
  pendingDeletedSubsidiIds.clear();
  pendingDeletedPengeluaranIds.clear();
  pendingDeletedKategoriIds.clear();
  pendingDeletedPeriodeIds.clear();
  inMemoryDb = {
    pengeluaran: [],
    subsidi: [],
    periode: [...DEFAULT_PERIODE],
    kategori: [...DEFAULT_KATEGORI],
  };
  if (!isServerlessOrProd()) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'data', 'bendahara_mmd.json');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}
  }
}

/**
 * Reset memory DB dan file lokal ke data awal bersih (tanpa data uji/simulasi)
 */
export function resetToCleanState(): AppDatabase {
  pendingDeletedSubsidiIds.clear();
  pendingDeletedPengeluaranIds.clear();
  pendingDeletedKategoriIds.clear();
  pendingDeletedPeriodeIds.clear();
  inMemoryDb = {
    pengeluaran: [],
    subsidi: [],
    periode: [...DEFAULT_PERIODE],
    kategori: [...DEFAULT_KATEGORI],
    config: {
      spreadsheetUrl: process.env.GOOGLE_SPREADSHEET_URL || '',
    },
  };
  if (!isServerlessOrProd()) {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, 'bendahara_mmd.json');
      fs.writeFileSync(filePath, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
    } catch (e) {}
  }
  return inMemoryDb;
}

/**
 * Mengakses database lokal / in-memory secara aman tanpa error filesystem di Vercel
 */
function getLocalDb(): AppDatabase {
  // Pastikan kategori dan periode bawaan selalu ada
  for (const defKat of DEFAULT_KATEGORI) {
    if (!inMemoryDb.kategori.some(k => matchCategory(k.namaKategori, defKat))) {
      inMemoryDb.kategori.unshift({ ...defKat });
    }
  }
  for (const defPer of DEFAULT_PERIODE) {
    if (!inMemoryDb.periode.some(p => p.labelPeriode.toLowerCase() === defPer.labelPeriode.toLowerCase())) {
      inMemoryDb.periode.unshift({ ...defPer });
    }
  }

  // Jika berjalan di lingkungan Vercel / serverless read-only / production, gunakan in-memory store murni
  if (isServerlessOrProd()) {
    return inMemoryDb;
  }

  // Khusus local dev / CLI: muat dari file jika tersedia
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'data', 'bendahara_mmd.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as AppDatabase;
      if (parsed.pengeluaran && inMemoryDb.pengeluaran.length === 0) inMemoryDb.pengeluaran = parsed.pengeluaran;
      if (parsed.subsidi && inMemoryDb.subsidi.length === 0) inMemoryDb.subsidi = parsed.subsidi;
      if (parsed.periode && parsed.periode.length > 0) {
        for (const p of parsed.periode) {
          if (!inMemoryDb.periode.some(x => x.id === p.id || x.labelPeriode.toLowerCase() === p.labelPeriode.toLowerCase())) {
            inMemoryDb.periode.push(p);
          }
        }
      }
      if (parsed.kategori && parsed.kategori.length > 0) {
        for (const k of parsed.kategori) {
          if (!inMemoryDb.kategori.some(x => x.id === k.id || matchCategory(x.namaKategori, k))) {
            inMemoryDb.kategori.push(k);
          }
        }
      }
    }
  } catch (err) {
    // Abaikan error filesystem
  }

  return inMemoryDb;
}

/**
 * Menyimpan data ke in-memory store dan safe file backup jika bukan di Vercel
 */
function persistLocalDb(db: AppDatabase): void {
  inMemoryDb = db;

  // Di Vercel / serverless / production, jangan pernah mencoba membuat direktori atau menulis file
  if (isServerlessOrProd()) {
    return;
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'bendahara_mmd.json');
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    // Abaikan error filesystem jika permission dibatasi
  }
}

// Aliases untuk kompatibilitas internal
const ensureLocalDb = getLocalDb;
const saveLocalDb = persistLocalDb;

export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxdJDjy-OTY4DXnBpK_TeVcr4gkSEXJB7meLnC3WCDTHv09QibfpfwTfPANKsi62zAo/exec';
export const DEFAULT_GOOGLE_SCRIPT_TOKEN = 'MMD2026';
export const DEFAULT_GOOGLE_SPREADSHEET_ID = '1PAqCW-KV52-5X5GUn61tAhYst3kOd5TvJuHnRTQvfig';
export const DEFAULT_GOOGLE_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1PAqCW-KV52-5X5GUn61tAhYst3kOd5TvJuHnRTQvfig/edit';

export function getEffectiveScriptConfig(): { url?: string; token?: string } {
  // Jika pengujian terisolasi aktif (test suite), jangan gunakan remote Google Sheets
  if (process.env.MMD_DISABLE_CSV_SYNC === 'true') {
    return {
      url: process.env.GOOGLE_SCRIPT_URL?.trim() || undefined,
      token: process.env.GOOGLE_SCRIPT_TOKEN?.trim() || undefined,
    };
  }

  const url = process.env.GOOGLE_SCRIPT_URL?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
  const token = process.env.GOOGLE_SCRIPT_TOKEN?.trim() || DEFAULT_GOOGLE_SCRIPT_TOKEN;
  return { url, token };
}

/**
 * Panggil Google Apps Script via HTTP POST
 */
async function callGoogleAppsScript(action: string, payloadData: any = {}): Promise<any> {
  const { url: scriptUrl, token } = getEffectiveScriptConfig();

  if (!scriptUrl || scriptUrl.length < 10) {
    return {
      success: false,
      isConfigured: false,
      error: 'URL Google Apps Script belum dikonfigurasi di file environment (.env.local / Vercel).',
    };
  }

  const effectiveToken = token || DEFAULT_GOOGLE_SCRIPT_TOKEN;

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: effectiveToken,
        action,
        ...payloadData,
      }),
      // Apps Script Web Apps sering me-redirect (302) ke script.googleusercontent.com
      redirect: 'follow',
      // Timeout 25 detik agar Google Apps Script memiliki cukup waktu untuk cold start
      signal: AbortSignal.timeout(25000),
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
  const scriptUrl = getEffectiveScriptConfig().url;
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (!scriptUrl) {
    return {
      connected: false,
      spreadsheetName: 'Belum Terhubung (Mode Lokal Aktif)',
      spreadsheetId: '-',
      lastSyncTime: now + ' WIB',
      error: 'Google Apps Script URL belum diisi di Environment Variables Vercel (.env.local). Silakan tambahkan GOOGLE_SCRIPT_URL pada dashboard hosting Anda.',
      isLocalFallback: true,
    };
  }

  const result = await callGoogleAppsScript('ping');
  if (result.success) {
    return {
      connected: true,
      spreadsheetName: result.spreadsheetName || 'Laporan_Pengeluaran',
      spreadsheetId: result.spreadsheetId || 'Tersinkron',
      lastSyncTime: now + ' WIB',
      isLocalFallback: false,
    };
  } else {
    // Fallback: Jika POST 'ping' terhambat, coba pemeriksaan cepat via GET
    try {
      const getRes = await fetch(scriptUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson.success || getJson.status === 'online') {
          return {
            connected: true,
            spreadsheetName: getJson.spreadsheetName || 'Laporan_Pengeluaran',
            spreadsheetId: getJson.spreadsheetId || 'Tersinkron',
            lastSyncTime: now + ' WIB',
            isLocalFallback: false,
          };
        }
      }
    } catch (fallbackErr) {
      // Abaikan fallback error dan gunakan error dari result
    }

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
 * Rekonsiliasi data dari CSV publik ke database lokal
 */
export async function reconcileCsvData(parsed: CsvParsedResult): Promise<void> {
  const localDb = ensureLocalDb();

  // 1. Rekonsiliasi Subsidi dari CSV
  for (const sub of parsed.subsidi) {
    if (pendingDeletedSubsidiIds.has(sub.id)) continue;
    const existIdx = localDb.subsidi.findIndex(s => s.id === sub.id);
    if (existIdx >= 0) {
      localDb.subsidi[existIdx] = { ...sub, syncStatus: 'synced' };
    } else {
      localDb.subsidi.push({ ...sub, syncStatus: 'synced' });
    }
  }

  // 2. Rekonsiliasi Pengeluaran dari CSV
  for (const exp of parsed.pengeluaran) {
    if (pendingDeletedPengeluaranIds.has(exp.id)) continue;
    const existIdx = localDb.pengeluaran.findIndex(p => p.id === exp.id);
    if (existIdx >= 0) {
      localDb.pengeluaran[existIdx] = { ...exp, syncStatus: 'synced' };
    } else {
      localDb.pengeluaran.push({ ...exp, syncStatus: 'synced' });
    }
  }

  // 3. Pastikan periode dan kategori terdaftar
  if (parsed.labelPeriode && !localDb.periode.some(p => p.labelPeriode.toLowerCase() === parsed.labelPeriode.toLowerCase())) {
    localDb.periode.push({
      id: parsed.periodeId,
      namaBulanHijriah: parsed.bulanHijriah,
      tahunHijriah: parsed.tahunHijriah,
      labelPeriode: parsed.labelPeriode,
      statusAktif: true,
      createdAt: new Date().toISOString(),
    });
  }

  persistLocalDb(localDb);
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
  const scriptUrl = getEffectiveScriptConfig().url;
  const localDb = ensureLocalDb();

  // Bersihkan data dummy lama jika ada
  localDb.pengeluaran = localDb.pengeluaran.filter(p => p.id !== 'EXP-mvpb01rl-1-eh8');
  localDb.subsidi = localDb.subsidi.filter(s => s.id !== 'SUB-mvpazy62-2hrs');

  // Jika data lokal masih kosong dari transaksi aktif, ambil data awal dari Google Sheets CSV publik
  if (localDb.pengeluaran.length === 0 && localDb.subsidi.length === 0 && !process.env.MMD_DISABLE_CSV_SYNC) {
    try {
      const csvResult = await syncFromPublishedCsv();
      if (csvResult.success && csvResult.data) {
        await reconcileCsvData(csvResult.data);
      }
    } catch (e) {}
  }

  if (scriptUrl) {
    const remote = await callGoogleAppsScript('getData');
    if (remote.success) {
      // Dukung respons Google Apps Script baik bentuk bersarang { data: { ... } } maupun rata { ... }
      const rawData = remote.data && typeof remote.data === 'object' ? remote.data : remote;
      const remotePengeluaran = Array.isArray(rawData.pengeluaran) ? rawData.pengeluaran : (Array.isArray(remote.pengeluaran) ? remote.pengeluaran : null);
      const remoteSubsidi = Array.isArray(rawData.subsidi) ? rawData.subsidi : (Array.isArray(remote.subsidi) ? remote.subsidi : null);
      const remotePeriode = Array.isArray(rawData.periode) ? rawData.periode : (Array.isArray(remote.periode) ? remote.periode : null);
      const remoteKategori = Array.isArray(rawData.kategori) ? rawData.kategori : (Array.isArray(remote.kategori) ? remote.kategori : null);

      // Sinkronkan data dari Google Sheets ke penyimpanan lokal sebagai cache
      if (remotePengeluaran) {
        localDb.pengeluaran = remotePengeluaran
          .filter((p: any) => {
            const pid = String(p.id || '').trim();
            const cat = String(p.catatan || '').toLowerCase();
            const nama = String(p.namaBarang || '').toLowerCase();
            return !pendingDeletedPengeluaranIds.has(pid) && !cat.includes('[dihapus]') && !nama.includes('[dihapus]');
          })
          .map((p: any, idx: number) => ({
            ...p,
            id: p.id && String(p.id).trim() ? String(p.id).trim() : `EXP-LEGACY-${idx + 1}-${String(p.tanggalTransaksi || '').replace(/-/g, '')}`,
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

      if (remoteSubsidi) {
        localDb.subsidi = remoteSubsidi
          .filter((s: any) => {
            const sid = String(s.id || '').trim();
            const cat = String(s.catatan || '').toLowerCase();
            const kat = String(s.kategoriNama || '').toLowerCase();
            return (
              !pendingDeletedSubsidiIds.has(sid) &&
              !cat.includes('[dihapus]') &&
              !kat.includes('tes')
            );
          })
          .map((s: any, idx: number) => ({
            ...s,
            id: s.id && String(s.id).trim() ? String(s.id).trim() : `SUB-LEGACY-${idx + 1}-${String(s.tanggalTransaksi || '').replace(/-/g, '')}`,
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

      if (remotePeriode) {
        const remotePers = remotePeriode
          .filter((per: any) => {
            const label = String(per.labelPeriode || '').trim();
            const id = String(per.id || '').trim();
            return (
              !label.startsWith('[Dihapus]') &&
              !label.toLowerCase().includes('tes periode') &&
              id !== 'PER-TEST' &&
              !pendingDeletedPeriodeIds.has(id)
            );
          })
          .map((per: any) => ({
            ...per,
            id: String(per.id || ''),
            namaBulanHijriah: String(per.namaBulanHijriah || ''),
            tahunHijriah: String(per.tahunHijriah || ''),
            labelPeriode: String(per.labelPeriode || ''),
            statusAktif:
              per.statusAktif === true ||
              per.statusAktif === 'TRUE' ||
              per.statusAktif === 'true' ||
              per.statusAktif === 1 ||
              per.statusAktif === '1',
            createdAt: String(per.createdAt || new Date().toISOString()),
          }));

        const mergedPeriode = [...remotePers];
        // Hanya seed default jika remote Google Sheets benar-benar kosong (setup awal)
        if (mergedPeriode.length === 0) {
          for (const defPer of DEFAULT_PERIODE) {
            if (!pendingDeletedPeriodeIds.has(defPer.id)) {
              mergedPeriode.push(defPer);
              callGoogleAppsScript('createPeriode', { data: defPer }).catch(() => {});
            }
          }
        }
        localDb.periode = mergedPeriode;
      }

      if (remoteKategori) {
        const remoteKats = remoteKategori
          .filter((kat: any) => {
            const name = String(kat.namaKategori || '').trim();
            const id = String(kat.id || '').trim();
            return (
              !name.startsWith('[Dihapus]') &&
              !name.toLowerCase().includes('tes kategori') &&
              id !== 'KAT-TEST' &&
              !pendingDeletedKategoriIds.has(id)
            );
          })
          .map((kat: any) => ({
            ...kat,
            id: String(kat.id || ''),
            namaKategori: String(kat.namaKategori || ''),
            statusAktif:
              kat.statusAktif === true ||
              kat.statusAktif === 'TRUE' ||
              kat.statusAktif === 'true' ||
              kat.statusAktif === 1 ||
              kat.statusAktif === '1',
            createdAt: String(kat.createdAt || new Date().toISOString()),
            updatedAt: String(kat.updatedAt || new Date().toISOString()),
            iconName: String(kat.iconName || 'account_balance'),
          }));

        const mergedKategori = [...remoteKats];
        // Hanya seed default jika remote Google Sheets benar-benar kosong (setup awal)
        if (mergedKategori.length === 0) {
          for (const defKat of DEFAULT_KATEGORI) {
            if (!pendingDeletedKategoriIds.has(defKat.id)) {
              mergedKategori.push(defKat);
              callGoogleAppsScript('createKategori', { data: defKat }).catch(() => {});
            }
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
      spreadsheetName: 'Penyimpanan Aman Aktif',
      spreadsheetId: '-',
      lastSyncTime: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
      error: 'Google Apps Script belum dikonfigurasi di Environment Variables Vercel. Menggunakan mode browser/in-memory.',
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
  return calculateFinancialSummary(
    pengeluaran,
    subsidi,
    kategoriList,
    filterPeriodeLabel,
    filterKategoriNama
  );
}


/**
 * 1. Tambah Pengeluaran (Mendukung Batch Multi-item dari 1 acara & Idempotency Key)
 */
export async function addPengeluaran(items: PengeluaranInput[]): Promise<{
  success: boolean;
  remoteConfirmed?: boolean;
  data?: PengeluaranItem[];
  error?: string;
}> {
  const now = new Date().toISOString();
  const eventId = 'EVT-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const localDb = ensureLocalDb();
  const scriptUrl = getEffectiveScriptConfig().url;
  const isRemoteActive = Boolean(scriptUrl);

  const preparedItems: PengeluaranItem[] = items.map((item, index) => {
    const jumlah = Number(item.jumlah) || 1;
    const hargaSatuan = Number(item.hargaSatuan) || 0;
    const total = Number(item.total) || jumlah * hargaSatuan;

    const matchedKat = localDb.kategori.find(k => matchCategory(item.kategoriNama, k) || matchCategory(item.kategoriId, k));
    const kategoriId = item.kategoriId || matchedKat?.id || '';
    const kategoriNama = matchedKat?.namaKategori || item.kategoriNama || '';

    return {
      id: item.id && String(item.id).trim()
        ? String(item.id).trim()
        : 'EXP-' + Date.now().toString(36) + '-' + (index + 1) + '-' + Math.random().toString(36).substring(2, 5),
      eventId: item.eventId || eventId,
      createdAt: now,
      updatedAt: now,
      tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
      periodeId: item.periodeId || '',
      bulanHijriah: item.bulanHijriah || '',
      tahunHijriah: item.tahunHijriah ? String(item.tahunHijriah) : '',
      kategoriId,
      kategoriNama,
      jenisAcara: item.jenisAcara || '',
      namaBarang: item.namaBarang || '',
      jumlah,
      satuan: item.satuan || 'pcs',
      hargaSatuan,
      total,
      catatan: item.catatan || '',
      syncStatus: isRemoteActive ? ('synced' as const) : ('pending' as const),
    };
  });

  // Jika terhubung dengan Google Apps Script, simpan langsung ke Google Sheets
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createPengeluaran', { data: preparedItems });
    if (!remote.success) {
      return {
        success: false,
        remoteConfirmed: false,
        error: remote.error || 'Gagal menyimpan transaksi ke Google Sheets.',
      };
    }
  }

  // Simpan ke local db dengan pencegahan duplikasi (Idempotent)
  for (const prep of preparedItems) {
    const existingIdx = localDb.pengeluaran.findIndex(p => p.id === prep.id);
    if (existingIdx !== -1) {
      localDb.pengeluaran[existingIdx] = prep;
    } else {
      localDb.pengeluaran.unshift(prep);
    }
  }
  saveLocalDb(localDb);

  return {
    success: true,
    remoteConfirmed: isRemoteActive,
    data: preparedItems,
  };
}

/**
 * 2. Update Pengeluaran
 */
export async function updatePengeluaran(item: Partial<PengeluaranItem> & { id: string }): Promise<{
  success: boolean;
  remoteConfirmed?: boolean;
  error?: string;
}> {
  if (!item.id) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updatePengeluaran', { data: item });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal memperbarui transaksi di Google Sheets.' };
    }
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
      syncStatus: scriptUrl ? 'synced' : 'pending',
    };
    saveLocalDb(localDb);
    return { success: true, remoteConfirmed: Boolean(scriptUrl) };
  }

  if (scriptUrl) {
    return { success: true, remoteConfirmed: true };
  }

  return { success: false, error: 'Transaksi tidak ditemukan.' };
}

/**
 * 3. Hapus Pengeluaran (Strict Remote Deletion Protection)
 */
export async function deletePengeluaran(id: string): Promise<{
  success: boolean;
  fromSheets?: boolean;
  error?: string;
}> {
  const targetId = String(id || '').trim();
  if (!targetId) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  let remoteDeleted = false;

  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deletePengeluaran', { id: targetId });
    if (remote.success) {
      remoteDeleted = true;
    } else {
      const isRemoteNotFound =
        remote.error &&
        (remote.error.toLowerCase().includes('tidak ditemukan') ||
         remote.error.toLowerCase().includes('not found') ||
         remote.error.toLowerCase().includes('kosong'));

      const isCsvOrLegacy =
        targetId.startsWith('EXP-CSV-') || targetId.startsWith('EXP-LEGACY-');

      if (isCsvOrLegacy || isRemoteNotFound) {
        // Item berasal dari CSV publik / lembar fisik atau memang tidak tercatat di Google Sheets.
        // Izinkan sukses agar data terhapus dari pembukuan kas & saldo kas langsung terhitung ulang!
        remoteDeleted = true;
      } else {
        // Soft-delete fallback jika Apps Script belum di-redeploy atau ID tidak cocok persis
        const fallback = await callGoogleAppsScript('updatePengeluaran', {
          data: { id: targetId, catatan: '[Dihapus] ' + targetId, namaBarang: '[Dihapus]', jumlah: 0, hargaSatuan: 0, total: 0 },
        }).catch(() => null);
        if (fallback?.success) {
          remoteDeleted = true;
        } else {
          // Jangan hapus lokal jika remote Google Sheets gagal karena jaringan / server error!
          return {
            success: false,
            error: remote.error || 'Gagal menghapus transaksi dari Google Sheets. Data buku kas tetap dipertahankan.',
          };
        }
      }
    }
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.pengeluaran.length;
  localDb.pengeluaran = localDb.pengeluaran.filter(p => String(p.id || '').trim() !== targetId);
  const localDeleted = localDb.pengeluaran.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    pendingDeletedPengeluaranIds.add(targetId);
    return { success: true, fromSheets: remoteDeleted };
  }

  return { success: false, error: 'Transaksi tidak ditemukan.' };
}

/**
 * 4. Tambah Subsidi
 */
export async function addSubsidi(item: SubsidiInput): Promise<{
  success: boolean;
  remoteConfirmed?: boolean;
  data?: SubsidiItem;
  error?: string;
}> {
  const now = new Date().toISOString();
  const localDb = ensureLocalDb();
  const matchedKat = localDb.kategori.find(k => matchCategory(item.kategoriNama, k) || matchCategory(item.kategoriId, k));
  const kategoriId = item.kategoriId || matchedKat?.id || '';
  const kategoriNama = matchedKat?.namaKategori || item.kategoriNama || '';
  const scriptUrl = getEffectiveScriptConfig().url;
  const isRemoteActive = Boolean(scriptUrl);

  const prepared: SubsidiItem = {
    id: item.id && String(item.id).trim()
      ? String(item.id).trim()
      : 'SUB-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
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
    syncStatus: isRemoteActive ? ('synced' as const) : ('pending' as const),
  };

  if (scriptUrl) {
    const remote = await callGoogleAppsScript('createSubsidi', { data: prepared });
    if (!remote.success) {
      return {
        success: false,
        remoteConfirmed: false,
        error: remote.error || 'Gagal menyimpan subsidi ke Google Sheets.',
      };
    }
  }

  // Simpan ke local db dengan pencegahan duplikasi (Idempotent)
  const existingIdx = localDb.subsidi.findIndex(s => s.id === prepared.id);
  if (existingIdx !== -1) {
    localDb.subsidi[existingIdx] = prepared;
  } else {
    localDb.subsidi.unshift(prepared);
  }
  saveLocalDb(localDb);

  return {
    success: true,
    remoteConfirmed: isRemoteActive,
    data: prepared,
  };
}

/**
 * 5. Update Subsidi
 */
export async function updateSubsidi(item: Partial<SubsidiItem> & { id: string }): Promise<{
  success: boolean;
  remoteConfirmed?: boolean;
  error?: string;
}> {
  if (!item.id) return { success: false, error: 'ID subsidi wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('updateSubsidi', { data: item });
    if (!remote.success) {
      return { success: false, error: remote.error || 'Gagal mengubah subsidi di Google Sheets.' };
    }
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
      syncStatus: scriptUrl ? 'synced' : 'pending',
    };
    saveLocalDb(localDb);
    return { success: true, remoteConfirmed: Boolean(scriptUrl) };
  }

  if (scriptUrl) {
    return { success: true, remoteConfirmed: true };
  }

  return { success: false, error: 'Subsidi tidak ditemukan.' };
}

/**
 * 6. Hapus Subsidi (Strict Remote Deletion Protection)
 */
export async function deleteSubsidi(id: string): Promise<{
  success: boolean;
  fromSheets?: boolean;
  error?: string;
}> {
  const targetId = String(id || '').trim();
  if (!targetId) return { success: false, error: 'ID subsidi wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  let remoteDeleted = false;

  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deleteSubsidi', { id: targetId });
    if (remote.success) {
      remoteDeleted = true;
    } else {
      const isRemoteNotFound =
        remote.error &&
        (remote.error.toLowerCase().includes('tidak ditemukan') ||
         remote.error.toLowerCase().includes('not found') ||
         remote.error.toLowerCase().includes('kosong'));

      const isCsvOrLegacy =
        targetId.startsWith('SUB-CSV-') || targetId.startsWith('SUB-LEGACY-');

      if (isCsvOrLegacy || isRemoteNotFound) {
        // Item berasal dari CSV publik / lembar fisik atau memang tidak tercatat di Google Sheets.
        // Izinkan sukses agar data terhapus dari pembukuan kas & saldo kas langsung terhitung ulang!
        remoteDeleted = true;
      } else {
        // Soft-delete fallback jika Apps Script belum di-redeploy atau ID tidak cocok persis
        const fallback = await callGoogleAppsScript('updateSubsidi', {
          data: { id: targetId, catatan: '[Dihapus] ' + targetId, nominal: 0 },
        }).catch(() => null);
        if (fallback?.success) {
          remoteDeleted = true;
        } else {
          // Jangan hapus lokal jika remote Google Sheets gagal!
          return {
            success: false,
            error: remote.error || 'Gagal menghapus subsidi dari Google Sheets. Data buku kas tetap dipertahankan.',
          };
        }
      }
    }
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.subsidi.length;
  localDb.subsidi = localDb.subsidi.filter(s => String(s.id || '').trim() !== targetId);
  const localDeleted = localDb.subsidi.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    pendingDeletedSubsidiIds.add(targetId);
    return { success: true, fromSheets: remoteDeleted };
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

  const scriptUrl = getEffectiveScriptConfig().url;
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

  const scriptUrl = getEffectiveScriptConfig().url;
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
 * 9. Hapus Periode
 */
export async function deletePeriode(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'ID periode wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  let remoteDeleted = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deletePeriode', { id });
    if (remote.success) {
      remoteDeleted = true;
    } else {
      // Fallback jika Apps Script deployment belum mendukung aksi deletePeriode
      const fallback = await callGoogleAppsScript('updatePeriode', {
        data: { id, statusAktif: false, labelPeriode: '[Dihapus] ' + id },
      }).catch(() => null);
      if (fallback?.success) {
        remoteDeleted = true;
      }
    }
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.periode.length;
  localDb.periode = localDb.periode.filter(p => p.id !== id);
  const localDeleted = localDb.periode.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    pendingDeletedPeriodeIds.add(id);
    return { success: true };
  }

  return { success: false, error: 'Periode tidak ditemukan.' };
}

/**
 * 10. Kelola Kategori (Tambah, Edit, Hapus)
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

  const scriptUrl = getEffectiveScriptConfig().url;
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

  const scriptUrl = getEffectiveScriptConfig().url;
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

export async function deleteKategori(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'ID kategori wajib ada.' };

  const scriptUrl = getEffectiveScriptConfig().url;
  let remoteDeleted = false;
  if (scriptUrl) {
    const remote = await callGoogleAppsScript('deleteKategori', { id });
    if (remote.success) {
      remoteDeleted = true;
    } else {
      // Fallback jika Apps Script deployment belum mendukung aksi deleteKategori
      const fallback = await callGoogleAppsScript('updateKategori', {
        data: { id, statusAktif: false, namaKategori: '[Dihapus] ' + id },
      }).catch(() => null);
      if (fallback?.success) {
        remoteDeleted = true;
      }
    }
  }

  const localDb = ensureLocalDb();
  const initialLen = localDb.kategori.length;
  localDb.kategori = localDb.kategori.filter(k => k.id !== id);
  const localDeleted = localDb.kategori.length < initialLen;
  if (localDeleted) {
    saveLocalDb(localDb);
  }

  if (remoteDeleted || localDeleted) {
    pendingDeletedKategoriIds.add(id);
    return { success: true };
  }

  return { success: false, error: 'Kategori tidak ditemukan.' };
}

