import { NextResponse } from 'next/server';
import { resetToCleanState } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cleanDb = resetToCleanState();
    return NextResponse.json({
      success: true,
      message: 'Seluruh data lokal dan simulasi pengujian telah dibersihkan. Sistem kembali ke data awal.',
      data: cleanDb,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mereset data.' },
      { status: 500 }
    );
  }
}
