import { NextRequest, NextResponse } from 'next/server';
import { triggerGenerateCetakLaporan } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const periode = body.periode || undefined;

    const result = await triggerGenerateCetakLaporan(periode);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || 'Sheet CETAK_PENGELUARAN di Google Sheets berhasil diperbarui.',
        data: result,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Gagal memperbarui sheet CETAK_PENGELUARAN di Google Sheets.',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Terjadi kesalahan sistem saat memperbarui laporan cetak.',
      },
      { status: 500 }
    );
  }
}
