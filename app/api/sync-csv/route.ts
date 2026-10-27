import { NextRequest, NextResponse } from 'next/server';
import { syncFromPublishedCsv } from '@/lib/csv-importer';
import { verifyAdminRequest } from '@/lib/auth';
import { getAllData } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara untuk menyinkronkan data.' },
        { status: 401 }
      );
    }

    const syncResult = await syncFromPublishedCsv();
    if (!syncResult.success || !syncResult.data) {
      return NextResponse.json(
        { success: false, error: syncResult.error || 'Gagal membaca CSV Google Sheets.' },
        { status: 500 }
      );
    }

    // Refresh database lokal
    const currentData = await getAllData();

    return NextResponse.json({
      success: true,
      message: `Data berhasil diperbarui dari Google Sheets (${syncResult.data.kategoriNama} - ${syncResult.data.labelPeriode}).`,
      stats: syncResult.stats,
      data: currentData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem saat sinkronisasi CSV.' },
      { status: 500 }
    );
  }
}
