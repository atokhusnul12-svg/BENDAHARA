import { NextRequest, NextResponse } from 'next/server';
import { addPengeluaran, deletePengeluaran, updatePengeluaran } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Mendukung batch item atau item tunggal
    let itemsToInsert = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      itemsToInsert = body.items.map((it: any) => ({
        ...it,
        periodeId: body.periodeId || it.periodeId || '',
        bulanHijriah: body.bulanHijriah || it.bulanHijriah || '',
        tahunHijriah: body.tahunHijriah || it.tahunHijriah || '',
        kategoriId: body.kategoriId || it.kategoriId || '',
        kategoriNama: body.kategoriNama || it.kategoriNama || '',
        jenisAcara: body.jenisAcara || it.jenisAcara || '',
        tanggalTransaksi: body.tanggalTransaksi || it.tanggalTransaksi || new Date().toISOString().split('T')[0],
        catatan: body.catatan || it.catatan || '',
      }));
    } else {
      itemsToInsert = [body];
    }

    // Validasi data
    for (const item of itemsToInsert) {
      if (!item.kategoriNama && !item.kategoriId) {
        return NextResponse.json({ success: false, error: 'Kategori kegiatan wajib dipilih.' }, { status: 400 });
      }
      if (!item.namaBarang || item.namaBarang.trim() === '') {
        return NextResponse.json({ success: false, error: 'Nama barang / rincian belanja wajib diisi.' }, { status: 400 });
      }
      if (!item.jumlah || Number(item.jumlah) <= 0) {
        return NextResponse.json({ success: false, error: 'Jumlah barang harus lebih dari nol (0).' }, { status: 400 });
      }
      if (item.hargaSatuan === undefined || Number(item.hargaSatuan) < 0) {
        return NextResponse.json({ success: false, error: 'Harga satuan tidak boleh bernilai negatif.' }, { status: 400 });
      }
    }

    const result = await addPengeluaran(itemsToInsert);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const remoteConfirmed = Boolean(result.remoteConfirmed);

    const NO_CACHE_HEADERS = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    };

    return NextResponse.json({
      success: true,
      remoteConfirmed,
      message: remoteConfirmed
        ? 'Pengeluaran berhasil disimpan dan terkonfirmasi di Google Sheets.'
        : 'Pengeluaran berhasil disimpan ke penyimpanan lokal (menunggu sinkronisasi).',
      data: result.data,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan saat memproses pengeluaran.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID transaksi pengeluaran wajib disertakan.' }, { status: 400 });
    }

    if (body.namaBarang !== undefined && !body.namaBarang.trim()) {
      return NextResponse.json({ success: false, error: 'Nama barang / rincian belanja tidak boleh kosong.' }, { status: 400 });
    }

    if (body.jumlah !== undefined && Number(body.jumlah) <= 0) {
      return NextResponse.json({ success: false, error: 'Jumlah barang harus lebih dari nol.' }, { status: 400 });
    }

    if (body.hargaSatuan !== undefined && Number(body.hargaSatuan) < 0) {
      return NextResponse.json({ success: false, error: 'Harga satuan tidak boleh negatif.' }, { status: 400 });
    }

    const result = await updatePengeluaran(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const isGSheets = Boolean(process.env.GOOGLE_SCRIPT_URL?.trim());

    return NextResponse.json({
      success: true,
      message: isGSheets
        ? 'Transaksi pengeluaran berhasil diperbarui di Google Sheets.'
        : 'Transaksi pengeluaran berhasil diperbarui.',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah data pengeluaran.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' },
        { status: 401, headers: { 'Cache-Control': 'no-store, no-cache' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter ID transaksi pengeluaran wajib ada.' }, { status: 400, headers: { 'Cache-Control': 'no-store, no-cache' } });
    }

    const result = await deletePengeluaran(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache' } });
    }

    const isGSheets = Boolean(process.env.GOOGLE_SCRIPT_URL?.trim());

    return NextResponse.json({
      success: true,
      message: isGSheets
        ? 'Transaksi pengeluaran berhasil dihapus dari Google Sheets.'
        : 'Transaksi pengeluaran berhasil dihapus.',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus transaksi.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  }
}
