import { NextRequest, NextResponse } from 'next/server';
import { addPeriode, deletePeriode, setActivePeriode } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.namaBulanHijriah || !body.tahunHijriah) {
      return NextResponse.json({ success: false, error: 'Bulan Hijriyah dan Tahun Hijriyah wajib diisi.' }, { status: 400 });
    }

    const result = await addPeriode({
      namaBulanHijriah: body.namaBulanHijriah,
      tahunHijriah: body.tahunHijriah,
      statusAktif: body.statusAktif,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Periode ${result.data?.labelPeriode} berhasil ditambahkan ke sistem & Google Sheets.`,
      data: result.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan periode baru.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID periode wajib disertakan.' }, { status: 400 });
    }

    const result = await setActivePeriode(body.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Periode aktif berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah periode aktif.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID periode wajib disertakan.' }, { status: 400 });
    }

    const result = await deletePeriode(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Periode berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus periode.' },
      { status: 500 }
    );
  }
}
