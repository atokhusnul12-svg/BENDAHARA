import {
  FinancialSummary,
  KategoriItem,
  PengeluaranItem,
  SubsidiItem,
} from './types';

/**
 * Normalisasi pencocokan kategori yang toleran
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
  if (b.startsWith(a + ' ') || b.startsWith(a + '(') || a.startsWith(b + ' ')) return true;
  if (a.includes('lbm') && b.includes('lbm')) return true;
  if (a.includes('tafaquh') && b.includes('tafaquh')) return true;
  if (a.includes('musyawaroh') && b.includes('musyawaroh')) return true;
  return false;
}

/**
 * Normalisasi perbandingan periode
 */
export function matchPeriod(
  item: { bulanHijriah?: string; tahunHijriah?: string; periodeId?: string },
  targetPeriode: string | undefined | null
): boolean {
  if (!targetPeriode || targetPeriode === 'Semua' || targetPeriode === 'Semua Periode') {
    return true;
  }

  const cleanTarget = targetPeriode.trim().toLowerCase();
  const itemPid = (item.periodeId || '').trim().toLowerCase();
  if (itemPid && itemPid === cleanTarget) return true;

  const itemLabel = `${item.bulanHijriah || ''} ${item.tahunHijriah || ''} H`
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return itemLabel === cleanTarget || (cleanTarget.includes(itemLabel) && itemLabel.length > 3);
}

/**
 * Fungsi kalkulasi keuangan sentral (Client & Server Safe)
 * Menjadi Single Source of Truth perhitungan ringkasan kas & alokasi lajnah
 */
export function calculateFinancialSummary(
  pengeluaran: PengeluaranItem[],
  subsidi: SubsidiItem[],
  kategoriList: KategoriItem[],
  filterPeriodeLabel?: string,
  filterKategoriNama?: string
): FinancialSummary {
  const isAllCategories = !filterKategoriNama || filterKategoriNama === 'Semua';

  // Filter berdasarkan periode
  let filteredPengeluaran = pengeluaran.filter(p => matchPeriod(p, filterPeriodeLabel));
  let filteredSubsidi = subsidi.filter(s => matchPeriod(s, filterPeriodeLabel));

  // Filter opsional berdasarkan kategori
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

  // Transaksi Terkonfirmasi (tercatat di Google Sheets / bukan draft pending)
  const confirmedPengeluaran = filteredPengeluaran.filter(p => p.syncStatus !== 'pending');
  const confirmedSubsidi = filteredSubsidi.filter(s => s.syncStatus !== 'pending');
  const totalPengeluaranTerkonfirmasi = confirmedPengeluaran.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalSubsidiTerkonfirmasi = confirmedSubsidi.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
  const saldoTerkonfirmasi = totalSubsidiTerkonfirmasi - totalPengeluaranTerkonfirmasi;

  const pendingCount = filteredPengeluaran.filter(p => p.syncStatus === 'pending').length +
    filteredSubsidi.filter(s => s.syncStatus === 'pending').length;
  const hasPendingSync = pendingCount > 0;

  const persentasePenggunaan = totalSubsidi > 0
    ? Math.round((totalPengeluaran / totalSubsidi) * 1000) / 10
    : 0;

  // Breakdown per Kategori
  const categorySummaries = kategoriList
    .filter(k => k.statusAktif !== false)
    .map(kat => {
      const katPengeluaran = pengeluaran.filter(p => {
        const matchesP = matchPeriod(p, filterPeriodeLabel);
        const matchesK = matchCategory(p.kategoriNama, kat) || matchCategory(p.kategoriId, kat);
        return matchesP && matchesK;
      });

      const katSubsidi = subsidi.filter(s => {
        const matchesP = matchPeriod(s, filterPeriodeLabel);
        const matchesK = matchCategory(s.kategoriNama, kat) || matchCategory(s.kategoriId, kat);
        return matchesP && matchesK;
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
    totalSubsidiTerkonfirmasi,
    totalPengeluaranTerkonfirmasi,
    saldoTerkonfirmasi,
    hasPendingSync,
    pendingCount,
  };
}
