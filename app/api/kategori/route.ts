import { NextRequest, NextResponse } from 'next/server';
import { addKategori, updateKategori } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.namaKategori || !body.namaKategori.trim()) {
      return NextResponse.json({ success: false, error: 'Nama kategori tidak boleh kosong.' }, { status: 400 });
    }

    const result = await addKategori(body.namaKategori);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Kategori "${result.data?.namaKategori}" berhasil ditambahkan.`,
      data: result.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan kategori.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID kategori wajib ada.' }, { status: 400 });
    }

    const result = await updateKategori(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah kategori.' },
      { status: 500 }
    );
  }
}
