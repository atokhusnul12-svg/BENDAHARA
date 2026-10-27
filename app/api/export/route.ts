import { NextRequest, NextResponse } from 'next/server';
import { calculateSummary, getAllData } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara untuk mengekspor data keuangan.' },
        { status: 401 }
      );
    }
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
    if (filterPeriode && filterPeriode !== 'Semua' && filterPeriode !== 'Semua Periode') {
      const target = filterPeriode.trim().toLowerCase();
      exportTransactions = exportTransactions.filter(
        p => `${p.bulanHijriah || ''} ${p.tahunHijriah || ''} H`.trim().toLowerCase() === target || (p.periodeId || '').trim().toLowerCase() === target
      );
    }
    if (filterKategori && filterKategori !== 'Semua') {
      exportTransactions = exportTransactions.filter(
        p => p.kategoriNama === filterKategori || p.kategoriId === filterKategori
      );
    }

    // Sheet 1: CETAK_PENGELUARAN (Format Vertikal Siap Cetak Dikelompokkan per Jenis Acara)
    const cetakRows: (string | number)[][] = [
      ['MAJELIS MUSYAWARAH & DIROSAH (MMD) PESANTREN'],
      ['LAPORAN PENGELUARAN BENDAHARA MMD'],
      [`Periode: ${summary.periodeLabel}   •   Dicetak: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`],
      [],
      ['No.', 'Jenis Acara / Rincian Belanja', 'Jumlah', 'Satuan', 'Harga Satuan (Rp)', 'Total (Rp)', 'Keterangan'],
    ];

    // Grouping berdasarkan jenis acara
    const groups: { [key: string]: { name: string; kategori: string; items: typeof exportTransactions } } = {};
    const groupOrder: string[] = [];

    for (const it of exportTransactions) {
      const raw = (it.jenisAcara || 'Kegiatan Umum').trim();
      const key = raw.toLowerCase();
      if (!groups[key]) {
        groups[key] = { name: raw, kategori: it.kategoriNama || '', items: [] };
        groupOrder.push(key);
      }
      groups[key].items.push(it);
    }

    let evtNum = 1;
    let grandTotal = 0;

    for (const key of groupOrder) {
      const grp = groups[key];
      cetakRows.push([evtNum, grp.name.toUpperCase(), '', '', '', '', grp.kategori ? `[${grp.kategori}]` : '']);
      let evtSubtotal = 0;

      for (let i = 0; i < grp.items.length; i++) {
        const item = grp.items[i];
        const isLast = (i === grp.items.length - 1);
        const prefix = isLast ? '└  ' : '├  ';
        const qty = Number(item.jumlah) || 1;
        const price = Number(item.hargaSatuan) || 0;
        const tot = Number(item.total) || (qty * price);
        evtSubtotal += tot;

        cetakRows.push([
          '',
          `   ${prefix}${item.namaBarang || '-'}`,
          qty,
          item.satuan || 'pcs',
          price,
          tot,
          (item.tanggalTransaksi || '') + (item.catatan ? ` • ${item.catatan}` : '')
        ]);
      }

      grandTotal += evtSubtotal;
      cetakRows.push(['', `Subtotal ${grp.name}`, '', '', '', evtSubtotal, '']);
      cetakRows.push([]); // Jeda baris kosong antar kelompok acara
      evtNum++;
    }

    cetakRows.push(['', 'TOTAL PENGELUARAN KAS', '', '', '', grandTotal, '']);
    cetakRows.push([]);
    cetakRows.push(['', 'Total Subsidi Kas Masuk', '', '', '', summary.totalSubsidi, '']);
    cetakRows.push(['', 'Total Realisasi Pengeluaran', '', '', '', grandTotal, '']);
    cetakRows.push(['', 'Sisa Saldo Kas Tersedia', '', '', '', summary.saldoTersisa, '']);

    const wsCetak = XLSX.utils.aoa_to_sheet(cetakRows);
    wsCetak['!cols'] = [
      { wch: 6 },   // No
      { wch: 38 },  // Jenis Acara / Rincian Belanja
      { wch: 10 },  // Jumlah
      { wch: 12 },  // Satuan
      { wch: 18 },  // Harga Satuan
      { wch: 18 },  // Total
      { wch: 26 },  // Keterangan
    ];

    // Sheet 2: Data Mentah Rincian Pengeluaran (Database Transaksi Datar)
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

    // Sheet 3: Ringkasan Finansial
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

    // CETAK_PENGELUARAN diletakkan sebagai sheet pertama agar langsung tampil saat dibuka
    XLSX.utils.book_append_sheet(workbook, wsCetak, 'CETAK_PENGELUARAN');
    XLSX.utils.book_append_sheet(workbook, wsTrans, 'Data_Mentah_Pengeluaran');
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan_Kas');

    const cleanPeriodeName = (summary.periodeLabel || 'Semua_Periode').replace(/\s+/g, '_');
    const filename = `Laporan_Kas_MMD_${cleanPeriodeName}`;

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(wsCetak);
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
