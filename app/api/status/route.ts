import { NextResponse } from 'next/server';
import { checkSyncStatus } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const status = await checkSyncStatus();
    return NextResponse.json(
      {
        success: true,
        data: status,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: {
          connected: false,
          spreadsheetName: 'Error Koneksi',
          spreadsheetId: '-',
          lastSyncTime: new Date().toLocaleString('id-ID') + ' WIB',
          error: error.message || 'Gagal memeriksa status koneksi.',
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  }
}
