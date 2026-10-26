import { NextRequest, NextResponse } from 'next/server';
import { addSubsidi, deleteSubsidi, updateSubsidi } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.kategoriNama && !body.kategoriId) {
      return NextResponse.json({ success: false, error: 'Kategori kegiatan wajib dipilih.' }, { status: 400 });
    }

    const nominal = Number(body.nominal);
    if (isNaN(nominal) || nominal <= 0) {
      return NextResponse.json({ success: false, error: 'Nominal subsidi harus berupa angka lebih besar dari nol.' }, { status: 400 });
    }

    const result = await addSubsidi(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Catatan penambahan subsidi berhasil disimpan ke Google Sheets.',
      data: result.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan subsidi.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID catatan subsidi wajib disertakan.' }, { status: 400 });
    }

    if (body.nominal !== undefined && Number(body.nominal) <= 0) {
      return NextResponse.json({ success: false, error: 'Nominal subsidi harus lebih besar dari 0.' }, { status: 400 });
    }

    const result = await updateSubsidi(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Data subsidi berhasil diperbarui di Google Sheets.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah subsidi.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID catatan subsidi wajib ada.' }, { status: 400 });
    }

    const result = await deleteSubsidi(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Catatan subsidi berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus subsidi.' },
      { status: 500 }
    );
  }
}
