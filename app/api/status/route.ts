import { NextResponse } from 'next/server';
import { checkSyncStatus } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const status = await checkSyncStatus();
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      data: {
        connected: false,
        spreadsheetName: 'Error Koneksi',
        spreadsheetId: '-',
        lastSyncTime: new Date().toLocaleString('id-ID') + ' WIB',
        error: error.message || 'Gagal memeriksa status koneksi.',
      },
    });
  }
}
