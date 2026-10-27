/**
 * Helper format mata uang Rupiah dan angka Indonesia
 */

export function formatRupiah(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseRupiah(amount) : amount;
  if (num === undefined || num === null || isNaN(num)) {
    return 'Rp 0';
  }
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatNumber(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseRupiah(amount) : amount;
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  return Math.round(num).toLocaleString('id-ID');
}


export function parseRupiah(value: string | number | undefined | null): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  // Hapus semua karakter selain angka dan tanda minus
  const cleanStr = value.toString().replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleanStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatTanggal(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
}

export const BULAN_HIJRIAH_LIST = [
  'Muharram',
  'Safar',
  'Rabiul Awal',
  'Rabiul Akhir',
  'Jumadal Ula',
  'Jumadal Akhir',
  'Rajab',
  "Sya'ban",
  'Ramadan',
  'Syawal',
  "Dzulqa'dah",
  'Dzulhijjah',
];
