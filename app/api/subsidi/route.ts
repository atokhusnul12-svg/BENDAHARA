import { NextRequest, NextResponse } from 'next/server';
import { addSubsidi, deleteSubsidi, updateSubsidi } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const body = await request.json();

    if (!body.kategoriNama && !body.kategoriId) {
      return NextResponse.json({ success: false, error: 'Kategori kegiatan wajib dipilih.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const nominal = Number(body.nominal);
    if (isNaN(nominal) || nominal <= 0) {
      return NextResponse.json({ success: false, error: 'Nominal subsidi harus berupa angka lebih besar dari nol.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await addSubsidi(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    const remoteConfirmed = Boolean(result.remoteConfirmed);

    return NextResponse.json({
      success: true,
      remoteConfirmed,
      message: remoteConfirmed
        ? 'Catatan penambahan subsidi berhasil disimpan ke Google Sheets.'
        : 'Catatan penambahan subsidi berhasil disimpan ke penyimpanan lokal (menunggu sinkronisasi).',
      data: result.data,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan subsidi.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID catatan subsidi wajib disertakan.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    if (body.nominal !== undefined && (isNaN(Number(body.nominal)) || Number(body.nominal) <= 0)) {
      return NextResponse.json({ success: false, error: 'Nominal subsidi harus lebih besar dari 0.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await updateSubsidi(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    const isGSheets = Boolean(process.env.GOOGLE_SCRIPT_URL?.trim());

    return NextResponse.json({
      success: true,
      message: isGSheets
        ? 'Data subsidi berhasil diperbarui di Google Sheets.'
        : 'Data subsidi berhasil diperbarui.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah subsidi.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID catatan subsidi wajib ada.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await deleteSubsidi(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    const isGSheets = Boolean(process.env.GOOGLE_SCRIPT_URL?.trim());

    return NextResponse.json({
      success: true,
      message: isGSheets
        ? 'Catatan subsidi berhasil dihapus dari Google Sheets.'
        : 'Catatan subsidi berhasil dihapus.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus subsidi.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
