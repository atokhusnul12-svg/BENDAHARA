import { NextRequest, NextResponse } from 'next/server';
import { calculateSummary, getAllData } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterPeriode = searchParams.get('periode') || undefined;
    const filterKategori = searchParams.get('kategori') || undefined;

    const data = await getAllData();
    const summary = calculateSummary(
      data.pengeluaran,
      data.subsidi,
      data.kategori,
      filterPeriode,
      filterKategori
    );

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        summary,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data keuangan.' },
      { status: 500 }
    );
  }
}
