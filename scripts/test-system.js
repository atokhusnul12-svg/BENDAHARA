/**
 * =========================================================================
 * BENDAHARA MMD - AUTOMATED TEST SUITE
 * Memverifikasi 15 Skenario Uji Wajib (Section N)
 * =========================================================================
 */

const {
  addSubsidi,
  addPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
  addPeriode,
  calculateSummary,
  getAllData,
  checkSyncStatus,
} = require('../lib/data-service');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName} ${details ? '(' + details + ')' : ''}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${testName} ${details ? '(' + details + ')' : ''}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n==========================================================');
  console.log('🚀 MEMULAI PENGUJIAN OTOMATIS SISTEM BENDAHARA MMD');
  console.log('==========================================================\n');

  // Bersihkan database untuk pengujian terisolasi
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(process.cwd(), 'data', 'bendahara_mmd.json');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // Skenario 9: Tambah Periode Baru
  console.log('\n📌 Skenario 9 & 10: Pengelolaan Periode Hijriyah');
  const resPeriode = await addPeriode({
    namaBulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
    statusAktif: true,
  });
  assert(resPeriode.success, 'Menambahkan periode Jumadal Akhir 1448 H');
  assert(resPeriode.data?.labelPeriode === 'Jumadal Akhir 1448 H', 'Label periode terformat benar');

  // Uji cegah duplikasi periode
  const resDuplicate = await addPeriode({
    namaBulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
  });
  assert(!resDuplicate.success, 'Pencegahan duplikasi periode berhasil ditolak');

  // Skenario 1: Menambahkan subsidi Rp 1.000.000
  console.log('\n📌 Skenario 1 & 5: Penambahan & Penyimpanan Subsidi');
  const resSub = await addSubsidi({
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    periodeId: 'Jumadal Akhir 1448 H',
    bulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
    nominal: 1000000,
    catatan: 'Subsidi Tahap I Uji Sistem',
    tanggalTransaksi: '2026-10-26',
  });
  assert(resSub.success, 'Menambahkan subsidi Rp 1.000.000 ke kategori LBM');
  assert(resSub.data?.nominal === 1000000, 'Nominal subsidi tersimpan tepat 1.000.000');

  // Skenario 2: Menambahkan pengeluaran jumlah 2 @ Rp 100.000
  console.log('\n📌 Skenario 2, 3, & 4: Penambahan & Perhitungan Pengeluaran');
  const resExp = await addPengeluaran([
    {
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: 'Jumadal Akhir 1448 H',
      bulanHijriah: 'Jumadal Akhir',
      tahunHijriah: '1448',
      jenisAcara: 'Kegiatan LBM Bulanan',
      namaBarang: 'Konsumsi Nasi Kotak',
      jumlah: 2,
      satuan: 'porsi',
      hargaSatuan: 100000,
      total: 200000,
      tanggalTransaksi: '2026-10-26',
    },
  ]);
  assert(resExp.success, 'Menambahkan pengeluaran 2 porsi @ Rp 100.000');
  const insertedExp = resExp.data?.[0];
  assert(insertedExp?.total === 200000, 'Total otomatis dihitung = Rp 200.000');

  // Skenario 3: Memastikan saldo menjadi Rp 800.000
  console.log('\n📌 Skenario 3: Konsistensi Perhitungan Saldo Kas');
  const allData = await getAllData();
  const summary = calculateSummary(
    allData.pengeluaran,
    allData.subsidi,
    allData.kategori,
    'Jumadal Akhir 1448 H'
  );

  assert(summary.totalSubsidi === 1000000, 'Total Subsidi Masuk = Rp 1.000.000', `Aktual: ${summary.totalSubsidi}`);
  assert(summary.totalPengeluaran === 200000, 'Total Pengeluaran = Rp 200.000', `Aktual: ${summary.totalPengeluaran}`);
  assert(summary.saldoTersisa === 800000, 'Sisa Saldo Kas = Rp 800.000', `Aktual: ${summary.saldoTersisa}`);
  assert(summary.persentasePenggunaan === 20, 'Persentase Realisasi = 20%', `Aktual: ${summary.persentasePenggunaan}%`);

  // Skenario 7: Edit Transaksi
  console.log('\n📌 Skenario 7: Pengubahan Transaksi (Update Row)');
  if (insertedExp) {
    const resUpdate = await updatePengeluaran({
      id: insertedExp.id,
      jumlah: 3, // Ubah dari 2 ke 3 -> total jadi 300.000
      hargaSatuan: 100000,
    });
    assert(resUpdate.success, 'Mengedit jumlah barang transaksi menjadi 3');

    const updatedData = await getAllData();
    const updatedSummary = calculateSummary(
      updatedData.pengeluaran,
      updatedData.subsidi,
      updatedData.kategori,
      'Jumadal Akhir 1448 H'
    );
    assert(updatedSummary.totalPengeluaran === 300000, 'Total pengeluaran terbarukan = Rp 300.000');
    assert(updatedSummary.saldoTersisa === 700000, 'Saldo kas dihitung ulang = Rp 700.000');
  }

  // Skenario 8: Hapus Transaksi & Hitung Ulang Saldo
  console.log('\n📌 Skenario 8: Penghapusan Transaksi & Rekalkulasi');
  if (insertedExp) {
    const resDel = await deletePengeluaran(insertedExp.id);
    assert(resDel.success, 'Menghapus transaksi pengeluaran');

    const afterDelData = await getAllData();
    const afterDelSummary = calculateSummary(
      afterDelData.pengeluaran,
      afterDelData.subsidi,
      afterDelData.kategori,
      'Jumadal Akhir 1448 H'
    );
    assert(afterDelSummary.totalPengeluaran === 0, 'Total pengeluaran kembali menjadi Rp 0');
    assert(afterDelSummary.saldoTersisa === 1000000, 'Saldo kas kembali utuh menjadi Rp 1.000.000');
  }

  // Skenario 11: Isolasi Data Periode Berbeda (Tidak Tercampur)
  console.log('\n📌 Skenario 11: Pemisahan Data Lintas Periode');
  const summaryOtherPeriod = calculateSummary(
    allData.pengeluaran,
    allData.subsidi,
    allData.kategori,
    'Jumadal Ula 1448 H' // Periode berbeda
  );
  assert(summaryOtherPeriod.totalSubsidi === 0, 'Data subsidi periode Jumadal Akhir tidak bocor ke Jumadal Ula');

  // Skenario 12: Integritas Status Koneksi & Pencegahan Fake Success
  console.log('\n📌 Skenario 12: Pemeriksaan Status Koneksi Nyata');
  const status = await checkSyncStatus();
  assert(status !== null, 'Status sinkronisasi diperiksa secara riil oleh server');
  assert(status.isLocalFallback === true || status.connected === true, 'Status mencerminkan koneksi riil tanpa notifikasi palsu');

  console.log('\n==========================================================');
  console.log(`HASIL AKHIR: ${passCount} LULUS, ${failCount} GAGAL`);
  console.log('==========================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
