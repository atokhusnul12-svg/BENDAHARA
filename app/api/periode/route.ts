import { NextRequest, NextResponse } from 'next/server';
import { addPeriode, setActivePeriode } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
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
