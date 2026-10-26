import { NextRequest, NextResponse } from 'next/server';
import { calculateSummary, getAllData } from '@/lib/data-service';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterPeriode = searchParams.get('periode') || undefined;
    const filterKategori = searchParams.get('kategori') || undefined;
    const format = searchParams.get('format') || 'xlsx';

    const data = await getAllData();
    const summary = calculateSummary(
      data.pengeluaran,
      data.subsidi,
      data.kategori,
      filterPeriode,
      filterKategori
    );

    // Filter transaksi yang akan diekspor
    let exportTransactions = data.pengeluaran;
    if (filterPeriode && filterPeriode !== 'Semua') {
      exportTransactions = exportTransactions.filter(
        p => (p.bulanHijriah + ' ' + p.tahunHijriah + ' H').trim() === filterPeriode.trim() || p.periodeId === filterPeriode
      );
    }
    if (filterKategori && filterKategori !== 'Semua') {
      exportTransactions = exportTransactions.filter(
        p => p.kategoriNama === filterKategori || p.kategoriId === filterKategori
      );
    }

    // Sheet 1: Rincian Pengeluaran
    const rows = exportTransactions.map((item, idx) => ({
      No: idx + 1,
      ID: item.id,
      Tanggal: item.tanggalTransaksi,
      Periode: `${item.bulanHijriah} ${item.tahunHijriah} H`,
      Kategori: item.kategoriNama,
      'Jenis Acara': item.jenisAcara,
      'Rincian Belanja': item.namaBarang,
      Jumlah: Number(item.jumlah),
      Satuan: item.satuan,
      'Harga Satuan (Rp)': Number(item.hargaSatuan),
      'Total (Rp)': Number(item.total),
      Catatan: item.catatan || '',
    }));

    // Sheet 2: Ringkasan
    const summaryRows = [
      { Parameter: 'Periode Laporan', Nilai: summary.periodeLabel },
      { Parameter: 'Total Subsidi Masuk (Rp)', Nilai: summary.totalSubsidi },
      { Parameter: 'Total Pengeluaran (Rp)', Nilai: summary.totalPengeluaran },
      { Parameter: 'Sisa Saldo Kas (Rp)', Nilai: summary.saldoTersisa },
      { Parameter: 'Persentase Realisasi', Nilai: `${summary.persentasePenggunaan}%` },
      { Parameter: 'Jumlah Transaksi', Nilai: summary.jumlahTransaksi },
      { Parameter: 'Waktu Ekspor', Nilai: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' },
    ];

    const workbook = XLSX.utils.book_new();

    const wsTrans = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Pesan: 'Belum ada transaksi pada periode ini' }]);
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

    XLSX.utils.book_append_sheet(workbook, wsTrans, 'Pengeluaran');
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan');

    const cleanPeriodeName = (summary.periodeLabel || 'Semua_Periode').replace(/\s+/g, '_');
    const filename = `Laporan_Kas_MMD_${cleanPeriodeName}`;

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(wsTrans);
      // Tambahkan UTF-8 BOM untuk kompatibilitas Excel
      const csvContent = '\uFEFF' + csv;
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengekspor laporan.' },
      { status: 500 }
    );
  }
}
