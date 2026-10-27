import { NextRequest, NextResponse } from 'next/server';
import { addPeriode, deletePeriode, setActivePeriode } from '@/lib/data-service';
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

    if (!body.namaBulanHijriah || !body.tahunHijriah) {
      return NextResponse.json({ success: false, error: 'Bulan Hijriyah dan Tahun Hijriyah wajib diisi.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await addPeriode({
      namaBulanHijriah: body.namaBulanHijriah,
      tahunHijriah: body.tahunHijriah,
      statusAktif: body.statusAktif,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: `Periode ${result.data?.labelPeriode} berhasil ditambahkan ke sistem & Google Sheets.`,
      data: result.data,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan periode baru.' },
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
      return NextResponse.json({ success: false, error: 'ID periode wajib disertakan.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await setActivePeriode(body.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: 'Periode aktif berhasil diperbarui.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah periode aktif.' },
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
      return NextResponse.json({ success: false, error: 'ID periode wajib disertakan.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const result = await deletePeriode(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      message: 'Periode berhasil dihapus.',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus periode.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
