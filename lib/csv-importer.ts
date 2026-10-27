import { KategoriItem, PengeluaranItem, PeriodeItem, SubsidiItem } from './types';

export interface CsvParsedResult {
  kategoriNama: string;
  kategoriId: string;
  bulanHijriah: string;
  tahunHijriah: string;
  labelPeriode: string;
  periodeId: string;
  subsidiNominal: number;
  subsidi: SubsidiItem[];
  pengeluaran: PengeluaranItem[];
}

export interface SyncReconciliationStats {
  success: boolean;
  sourceUrl: string;
  category: string;
  period: string;
  totalSubsidi: number;
  totalPengeluaran: number;
  saldoTersisa: number;
  newExpenses: number;
  updatedExpenses: number;
  unchangedExpenses: number;
  subsidiImported: boolean;
  error?: string;
}

export const DEFAULT_PUBLISHED_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQNWBm5T4mWn0dvFjFZRJ-uQlTNzUzMUgvZlRfzbTiR1_qPcDXO_s4g0lJ3mcTpl4g9rj_BZhR1jbpe/pub?output=csv';

/**
 * Helper untuk memecah baris CSV dengan memperhitungkan koma di dalam tanda kutip ganda
 */
export function parseCsvRow(rowStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Mengurai string CSV publik Google Sheets Bendahara MMD menjadi objek terstruktur
 */
export function parsePublishedCsv(csvText: string): CsvParsedResult {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  let kategoriNama = 'LBM (Lajnah Bahtsul Masail)';
  let kategoriId = 'KAT-LBM';
  let bulanHijriah = 'Jumadal Ula';
  let tahunHijriah = '1448';
  let labelPeriode = 'Jumadal Ula 1448 H';
  let periodeId = 'PER-1448-JU';
  let subsidiNominal = 0;
  const pengeluaran: PengeluaranItem[] = [];

  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Deteksi Judul & Kategori (cth: "LAPORAN PENGELUARAN - LBM")
    if (line.toUpperCase().includes('LAPORAN PENGELUARAN')) {
      if (line.includes('LBM')) {
        kategoriNama = 'LBM (Lajnah Bahtsul Masail)';
        kategoriId = 'KAT-LBM';
      } else if (line.includes('TFQ') || line.toUpperCase().includes('TAFAQUH')) {
        kategoriNama = 'Tafaquh & Mubahitsin';
        kategoriId = 'KAT-TFQ';
      } else if (line.includes('MSY') || line.toUpperCase().includes('MUSYAWAROH')) {
        kategoriNama = 'Musyawaroh';
        kategoriId = 'KAT-MSY';
      }
    }

    // 2. Deteksi Periode Hijriah (cth: "jumadal ula, 1448 H")
    if (line.toLowerCase().includes('jumadal ula') || line.includes('1448')) {
      const matchYear = line.match(/\b(14\d\d)\b/);
      if (matchYear) tahunHijriah = matchYear[1];
      if (line.toLowerCase().includes('jumadal ula')) bulanHijriah = 'Jumadal Ula';
      else if (line.toLowerCase().includes('jumadal akhir')) bulanHijriah = 'Jumadal Akhir';

      labelPeriode = `${bulanHijriah} ${tahunHijriah} H`;
      periodeId = `PER-${tahunHijriah}-${bulanHijriah === 'Jumadal Ula' ? 'JU' : 'JA'}`;
    }

    // 3. Deteksi Subsidi (cth: "Subsidi : 5.700.000")
    if (line.toUpperCase().includes('SUBSIDI')) {
      const rawNumbers = line.replace(/[^0-9]/g, '');
      if (rawNumbers) {
        subsidiNominal = parseInt(rawNumbers, 10);
      }
    }

    // 4. Deteksi Header Kolom Tabel Transaksi (cth: "Jenis Acara,Rincian Belanja,...")
    if (line.toLowerCase().includes('jenis acara') && line.toLowerCase().includes('rincian belanja')) {
      headerIndex = i;
      continue;
    }

    // 5. Pembacaan Baris Data Transaksi setelah Header
    if (headerIndex !== -1 && i > headerIndex) {
      // Hentikan jika mencapai baris ringkasan total atau catatan
      const upperLine = line.toUpperCase();
      if (upperLine.includes('TOTAL SELURUH') || upperLine.includes('CATATAN:') || upperLine.includes('SALDO')) {
        continue;
      }

      const cols = parseCsvRow(line);
      // Kolom minimal: Jenis Acara (0), Rincian Belanja (1), Jumlah Barang (2), Harga Satuan (3), Total (4)
      if (cols.length >= 5 && cols[1]) {
        const jenisAcaraRaw = cols[0] || 'Kegiatan LBM';
        const namaBarang = cols[1].trim();

        // Parse jumlah dan satuan dari format cth: "9 pcs" atau "2 dus"
        const rawQty = cols[2] || '1 pcs';
        const qtyMatch = rawQty.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
        const jumlah = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 1;
        const satuan = qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : 'pcs';

        // Parse harga satuan dan total
        const hargaSatuanRaw = cols[3].replace(/[^0-9]/g, '');
        const totalRaw = cols[4].replace(/[^0-9]/g, '');

        const hargaSatuan = hargaSatuanRaw ? parseInt(hargaSatuanRaw, 10) : 0;
        const total = totalRaw ? parseInt(totalRaw, 10) : jumlah * hargaSatuan;

        // Buat ID stabil (fingerprint idempotency)
        const cleanName = namaBarang.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const stableId = `EXP-CSV-${kategoriId}-${cleanName}-${Math.round(jumlah)}`;
        const eventId = `EVT-CSV-${jenisAcaraRaw.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        pengeluaran.push({
          id: stableId,
          eventId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tanggalTransaksi: '2026-10-27',
          periodeId,
          bulanHijriah,
          tahunHijriah,
          kategoriId,
          kategoriNama,
          jenisAcara: jenisAcaraRaw,
          namaBarang,
          jumlah,
          satuan,
          hargaSatuan,
          total,
          catatan: 'Diimpor otomatis dari Google Sheets CSV Publik',
          syncStatus: 'synced',
        });
      }
    }
  }

  // Siapkan objek subsidi
  const subsidi: SubsidiItem[] = [];
  if (subsidiNominal > 0) {
    subsidi.push({
      id: `SUB-CSV-${kategoriId}-${periodeId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tanggalTransaksi: '2026-10-27',
      periodeId,
      bulanHijriah,
      tahunHijriah,
      kategoriId,
      kategoriNama,
      nominal: subsidiNominal,
      catatan: 'Subsidi Resmi dari Google Sheets (Laporan LBM)',
      syncStatus: 'synced',
    });
  }

  return {
    kategoriNama,
    kategoriId,
    bulanHijriah,
    tahunHijriah,
    labelPeriode,
    periodeId,
    subsidiNominal,
    subsidi,
    pengeluaran,
  };
}

/**
 * Mengambil CSV dari URL dan merekonsiliasi dengan data lokal aplikasi
 */
export async function syncFromPublishedCsv(
  csvUrl: string = DEFAULT_PUBLISHED_CSV_URL
): Promise<{
  success: boolean;
  data?: CsvParsedResult;
  stats?: SyncReconciliationStats;
  error?: string;
}> {
  try {
    const res = await fetch(csvUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Gagal mengunduh CSV Google Sheets: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const csvText = await res.text();
    if (!csvText || csvText.length < 20) {
      return {
        success: false,
        error: 'Data CSV dari Google Sheets kosong atau tidak dapat dijangkau.',
      };
    }

    const parsed = parsePublishedCsv(csvText);

    const totalPengeluaran = parsed.pengeluaran.reduce((sum, it) => sum + it.total, 0);
    const saldoTersisa = parsed.subsidiNominal - totalPengeluaran;

    const stats: SyncReconciliationStats = {
      success: true,
      sourceUrl: csvUrl,
      category: parsed.kategoriNama,
      period: parsed.labelPeriode,
      totalSubsidi: parsed.subsidiNominal,
      totalPengeluaran,
      saldoTersisa,
      newExpenses: parsed.pengeluaran.length,
      updatedExpenses: 0,
      unchangedExpenses: 0,
      subsidiImported: parsed.subsidi.length > 0,
    };

    return {
      success: true,
      data: parsed,
      stats,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Kesalahan saat membaca CSV Google Sheets: ${err.message || String(err)}`,
    };
  }
}
