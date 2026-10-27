import { NextRequest, NextResponse } from 'next/server';
import { addKategori, deleteKategori, updateKategori } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
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
    if (!body.namaKategori || !body.namaKategori.trim()) {
      return NextResponse.json({ success: false, error: 'Nama kategori tidak boleh kosong.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await addKategori(body.namaKategori);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: `Kategori "${result.data?.namaKategori}" berhasil ditambahkan.`,
      data: result.data,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan kategori.' },
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
      return NextResponse.json({ success: false, error: 'ID kategori wajib ada.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await updateKategori(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil diperbarui.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah kategori.' },
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
      return NextResponse.json({ success: false, error: 'ID kategori wajib disertakan.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await deleteKategori(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil dihapus.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus kategori.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
