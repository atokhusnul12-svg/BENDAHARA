/**
 * =========================================================================
 * BENDAHARA MMD - AUTOMATED TEST SUITE MENYELURUH (TAHAP 8)
 * Menguji 6 Skenario Wajib: Tes A, Tes B, Tes C, Tes D, Tes E, Tes F
 * Lingkungan Pengujian Terisolasi (Tidak Menyentuh Spreadsheet Produksi)
 * =========================================================================
 */

const fs = require('fs');
const path = require('path');

// Pastikan pengujian berjalan di lingkungan lokal terisolasi tanpa merusak spreadsheet kas asli
delete process.env.GOOGLE_SCRIPT_URL;

const {
  addSubsidi,
  updateSubsidi,
  deleteSubsidi,
  addPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
  addPeriode,
  addKategori,
  matchCategory,
  calculateSummary,
  getAllData,
  checkSyncStatus,
  resetLocalDbForTesting,
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

async function runAllTests() {
  console.log('\n==========================================================');
  console.log('🚀 MEMULAI PENGUJIAN MENYELURUH SISTEM BENDAHARA MMD');
  console.log('   (Pengujian Terisolasi: Tes A s/d Tes F)');
  console.log('==========================================================\n');

  // Bersihkan database memory & file untuk pengujian terisolasi
  if (typeof resetLocalDbForTesting === 'function') {
    resetLocalDbForTesting();
  }
  const dbPath = path.join(process.cwd(), 'data', 'bendahara_mmd.json');
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {}
  }

  // =========================================================================
  // TES A — Perhitungan Pengeluaran Multi-Rincian
  // =========================================================================
  console.log('📌 TES A — Perhitungan Pengeluaran Multi-Rincian');
  console.log('   Spesifikasi: Subsidi Rp1.000.000, Barang A (2 x 100k = 200k), Barang B (3 x 50k = 150k)');
  console.log('   Ekspektasi: Total Pengeluaran = Rp350.000, Saldo Tersisa = Rp650.000\n');

  // Siapkan Periode Uji
  const resPeriodeA = await addPeriode({
    namaBulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    statusAktif: true,
  });
  // Jika sudah ada default, tidak apa-apa
  const testPeriodLabel = 'Jumadal Ula 1448 H';

  // 1. Tambah Subsidi Rp 1.000.000
  const subA = await addSubsidi({
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    periodeId: testPeriodLabel,
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    nominal: 1000000,
    catatan: 'Subsidi Kas Tes A',
    tanggalTransaksi: '2026-10-26',
  });
  assert(subA.success && subA.data?.nominal === 1000000, 'Tes A1: Subsidi Rp 1.000.000 berhasil dicatat');

  // 2. Tambah Pengeluaran Multi-rincian (Barang A & Barang B dalam 1 acara)
  const expA = await addPengeluaran([
    {
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Bahtsul Masail Wustho',
      namaBarang: 'Barang A (Kitab Fathul Qorib)',
      jumlah: 2,
      satuan: 'jilid',
      hargaSatuan: 100000,
      total: 200000,
      tanggalTransaksi: '2026-10-26',
    },
    {
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Bahtsul Masail Wustho',
      namaBarang: 'Barang B (Konsumsi Snack)',
      jumlah: 3,
      satuan: 'dus',
      hargaSatuan: 50000,
      total: 150000,
      tanggalTransaksi: '2026-10-26',
    },
  ]);
  assert(expA.success && expA.data?.length === 2, 'Tes A2: Batch 2 rincian barang berhasil diproses');
  assert(expA.data[0].total === 200000, 'Tes A3: Total Barang A = 2 × 100.000 = Rp 200.000');
  assert(expA.data[1].total === 150000, 'Tes A4: Total Barang B = 3 × 50.000 = Rp 150.000');
  assert(expA.data[0].eventId === expA.data[1].eventId, 'Tes A5: Kedua rincian memiliki eventId yang sama');

  // 3. Verifikasi Total dan Saldo
  const dataA = await getAllData();
  const summaryA = calculateSummary(dataA.pengeluaran, dataA.subsidi, dataA.kategori, testPeriodLabel);
  const totalPengeluaranAcara = expA.data[0].total + expA.data[1].total;
  assert(totalPengeluaranAcara === 350000, 'Tes A6: Total pengeluaran acara = Rp 350.000', `Aktual: ${totalPengeluaranAcara}`);
  assert(summaryA.totalPengeluaran === 350000, 'Tes A7: Ringkasan Total Pengeluaran = Rp 350.000', `Aktual: ${summaryA.totalPengeluaran}`);
  assert(summaryA.saldoTersisa === 650000, 'Tes A8: Saldo Kas Tersisa = Rp 650.000 (1jt - 350k)', `Aktual: ${summaryA.saldoTersisa}`);
  assert(summaryA.persentasePenggunaan === 35, 'Tes A9: Persentase penggunaan = 35%', `Aktual: ${summaryA.persentasePenggunaan}%`);

  // =========================================================================
  // TES B — Penyimpanan & Persistensi Data
  // =========================================================================
  console.log('\n📌 TES B — Penyimpanan & Persistensi Data');
  console.log('   Spesifikasi: Simpan transaksi, verifikasi database lokal, reload dari storage\n');

  // Verifikasi file database lokal benar-benar ada dan berisi data
  assert(fs.existsSync(dbPath), 'Tes B1: File penyimpanan data lokal bendahara_mmd.json tersedia di disk');
  const diskRaw = fs.readFileSync(dbPath, 'utf-8');
  const diskParsed = JSON.parse(diskRaw);
  assert(diskParsed.pengeluaran.length >= 2, 'Tes B2: Data tersimpan persisten di disk', `Count: ${diskParsed.pengeluaran.length}`);

  // Simulasikan browser refresh / reload server instance
  const freshData = await getAllData();
  const itemInList = freshData.pengeluaran.find(p => p.namaBarang === 'Barang A (Kitab Fathul Qorib)');
  assert(itemInList !== undefined, 'Tes B3: Transaksi muncul kembali setelah reload data');
  assert(itemInList?.hargaSatuan === 100000 && itemInList?.jumlah === 2, 'Tes B4: Nominal dan rincian transaksi utuh');

  // =========================================================================
  // TES C — Edit dan Hapus Transaksi (ID Stabil & Rekalkulasi Saldo)
  // =========================================================================
  console.log('\n📌 TES C — Edit dan Hapus Transaksi');
  console.log('   Spesifikasi: Edit rincian, periksa stabilitas ID, pastikan saldo terhitung ulang, lalu hapus\n');

  const targetEdit = expA.data[0]; // Barang A (Rp 200.000)
  const originalId = targetEdit.id;

  // 1. Edit Barang A: ubah jumlah dari 2 menjadi 4 (seharusnya total jadi 400.000)
  const resUpdate = await updatePengeluaran({
    id: originalId,
    jumlah: 4,
    hargaSatuan: 100000,
  });
  assert(resUpdate.success, 'Tes C1: Edit transaksi pengeluaran berhasil');

  const afterEditData = await getAllData();
  const editedItem = afterEditData.pengeluaran.find(p => p.id === originalId);
  assert(editedItem?.id === originalId, 'Tes C2: ID transaksi tetap sama / stabil setelah edit');
  assert(editedItem?.jumlah === 4, 'Tes C3: Jumlah barang terupdate menjadi 4');
  assert(editedItem?.total === 400000, 'Tes C4: Total rincian terhitung ulang menjadi Rp 400.000');

  // Cek saldo setelah edit: Subsidi 1.000.000, Barang A = 400k, Barang B = 150k -> Total = 550k, Saldo = 450k
  const summaryAfterEdit = calculateSummary(afterEditData.pengeluaran, afterEditData.subsidi, afterEditData.kategori, testPeriodLabel);
  assert(summaryAfterEdit.totalPengeluaran === 550000, 'Tes C5: Total pengeluaran terbarukan = Rp 550.000', `Aktual: ${summaryAfterEdit.totalPengeluaran}`);
  assert(summaryAfterEdit.saldoTersisa === 450000, 'Tes C6: Saldo kas terhitung ulang = Rp 450.000', `Aktual: ${summaryAfterEdit.saldoTersisa}`);

  // 2. Hapus Barang B (Rp 150.000)
  const targetDel = expA.data[1]; // Barang B
  const resDel = await deletePengeluaran(targetDel.id);
  assert(resDel.success, 'Tes C7: Hapus transaksi Barang B berhasil');

  const afterDelData = await getAllData();
  const deletedItem = afterDelData.pengeluaran.find(p => p.id === targetDel.id);
  assert(deletedItem === undefined, 'Tes C8: Transaksi Barang B benar-benar terhapus dari daftar');

  // Sisa hanya Barang A (400.000). Total pengeluaran = 400k, Saldo = 600k
  const summaryAfterDel = calculateSummary(afterDelData.pengeluaran, afterDelData.subsidi, afterDelData.kategori, testPeriodLabel);
  assert(summaryAfterDel.totalPengeluaran === 400000, 'Tes C9: Total pengeluaran setelah hapus = Rp 400.000', `Aktual: ${summaryAfterDel.totalPengeluaran}`);
  assert(summaryAfterDel.saldoTersisa === 600000, 'Tes C10: Saldo kas kembali sesuai rekalkulasi = Rp 600.000', `Aktual: ${summaryAfterDel.saldoTersisa}`);

  // =========================================================================
  // TES D — Subsidi (Tambah, Edit, Hapus, & Saldo)
  // =========================================================================
  console.log('\n📌 TES D — Pengelolaan Subsidi Kas');
  console.log('   Spesifikasi: Tambah subsidi baru, verifikasi saldo naik, edit nominal, hapus subsidi\n');

  // 1. Tambah Subsidi kedua Rp 500.000
  const subD = await addSubsidi({
    kategoriNama: 'Musyawaroh',
    periodeId: testPeriodLabel,
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    nominal: 500000,
    catatan: 'Subsidi Tambahan Musyawaroh',
    tanggalTransaksi: '2026-10-26',
  });
  assert(subD.success, 'Tes D1: Tambah subsidi baru Rp 500.000 berhasil');

  const dataD1 = await getAllData();
  const summaryD1 = calculateSummary(dataD1.pengeluaran, dataD1.subsidi, dataD1.kategori, testPeriodLabel);
  // Total Subsidi awal 1jt + 500k = 1.5jt. Pengeluaran = 400k. Saldo = 1.1jt
  assert(summaryD1.totalSubsidi === 1500000, 'Tes D2: Total Subsidi bertambah menjadi Rp 1.500.000', `Aktual: ${summaryD1.totalSubsidi}`);
  assert(summaryD1.saldoTersisa === 1100000, 'Tes D3: Saldo bertambah menjadi Rp 1.100.000', `Aktual: ${summaryD1.saldoTersisa}`);

  // 2. Edit Subsidi kedua: ubah dari 500k menjadi 800k
  const resUpdateSub = await updateSubsidi({
    id: subD.data.id,
    nominal: 800000,
  });
  assert(resUpdateSub.success, 'Tes D4: Edit nominal subsidi berhasil');

  const dataD2 = await getAllData();
  const summaryD2 = calculateSummary(dataD2.pengeluaran, dataD2.subsidi, dataD2.kategori, testPeriodLabel);
  // Total Subsidi = 1jt + 800k = 1.8jt. Pengeluaran = 400k. Saldo = 1.4jt
  assert(summaryD2.totalSubsidi === 1800000, 'Tes D5: Total Subsidi terupdate menjadi Rp 1.800.000', `Aktual: ${summaryD2.totalSubsidi}`);
  assert(summaryD2.saldoTersisa === 1400000, 'Tes D6: Saldo kas dihitung ulang menjadi Rp 1.400.000', `Aktual: ${summaryD2.saldoTersisa}`);

  // 3. Hapus Subsidi kedua
  const resDelSub = await deleteSubsidi(subD.data.id);
  assert(resDelSub.success, 'Tes D7: Hapus catatan subsidi berhasil');

  const dataD3 = await getAllData();
  const summaryD3 = calculateSummary(dataD3.pengeluaran, dataD3.subsidi, dataD3.kategori, testPeriodLabel);
  // Kembali ke subsidi 1jt, saldo 600k
  assert(summaryD3.totalSubsidi === 1000000, 'Tes D8: Total Subsidi kembali Rp 1.000.000 setelah penghapusan', `Aktual: ${summaryD3.totalSubsidi}`);
  assert(summaryD3.saldoTersisa === 600000, 'Tes D9: Saldo kas kembali Rp 600.000', `Aktual: ${summaryD3.saldoTersisa}`);

  // =========================================================================
  // TES E — Pengelolaan Periode Hijriyah & Isolasi Saldo
  // =========================================================================
  console.log('\n📌 TES E — Periode Hijriyah & Isolasi Saldo Lintas Periode');
  console.log('   Spesifikasi: Tambah Jumadal Akhir 1448 H, transaksi baru, cek isolasi saldo\n');

  // 1. Tambah periode baru: Jumadal Akhir 1448 H
  const resNewPer = await addPeriode({
    namaBulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
    statusAktif: false,
  });
  assert(resNewPer.success, 'Tes E1: Berhasil menambahkan periode Jumadal Akhir 1448 H');
  assert(resNewPer.data?.labelPeriode === 'Jumadal Akhir 1448 H', 'Tes E2: Label periode terformat tepat');

  // 2. Tambahkan transaksi subsidi khusus di periode Jumadal Akhir
  const subE = await addSubsidi({
    kategoriNama: 'Tafaquh & Mubahitsin',
    periodeId: 'Jumadal Akhir 1448 H',
    bulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
    nominal: 750000,
    catatan: 'Subsidi Kas Periode Jumadal Akhir',
    tanggalTransaksi: '2026-11-25',
  });
  assert(subE.success, 'Tes E3: Berhasil menyimpan transaksi pada periode Jumadal Akhir 1448 H');

  // 3. Verifikasi Isolasi Periode
  const dataE = await getAllData();
  const summaryJumadalUla = calculateSummary(dataE.pengeluaran, dataE.subsidi, dataE.kategori, 'Jumadal Ula 1448 H');
  const summaryJumadalAkhir = calculateSummary(dataE.pengeluaran, dataE.subsidi, dataE.kategori, 'Jumadal Akhir 1448 H');

  assert(summaryJumadalUla.totalSubsidi === 1000000, 'Tes E4: Saldo Jumadal Ula tetap Rp 1.000.000 (tidak bocor)');
  assert(summaryJumadalAkhir.totalSubsidi === 750000, 'Tes E5: Saldo Jumadal Akhir terhitung mandiri Rp 750.000');
  assert(summaryJumadalAkhir.totalPengeluaran === 0, 'Tes E6: Pengeluaran periode lain tidak tercampur ke Jumadal Akhir');

  // =========================================================================
  // TES F — Kegagalan, Validasi, & Proteksi Integritas
  // =========================================================================
  console.log('\n📌 TES F — Penanganan Kegagalan & Validasi Integritas');
  console.log('   Spesifikasi: Cegah duplikasi, input invalid, status koneksi riil tanpa fake success\n');

  // 1. Pencegahan duplikasi periode
  const dupPeriod = await addPeriode({
    namaBulanHijriah: 'Jumadal Akhir',
    tahunHijriah: '1448',
  });
  assert(!dupPeriod.success, 'Tes F1: Pencegahan penambahan periode duplikat berhasil ditolak');

  // 2. Pemeriksaan status sinkronisasi nyata saat offline
  const status = await checkSyncStatus();
  assert(status.connected === false, 'Tes F2: Sistem mendeteksi Sheets tidak terhubung dengan benar');
  assert(status.isLocalFallback === true, 'Tes F3: Mode lokal fallback diaktifkan secara transparan');
  assert(!status.spreadsheetName.includes('Tersambung Google Sheets'), 'Tes F4: Tidak ada klaim palsu bahwa Google Sheets tersinkron');

  // 3. Validasi kegagalan update & delete ID yang tidak ada
  const badUpdate = await updatePengeluaran({ id: 'EXP-TIDAK-ADA', jumlah: 5 });
  assert(!badUpdate.success, 'Tes F5: Update ID yang tidak ada ditolak dengan pesan error yang jelas');

  const badDelete = await deletePengeluaran('EXP-TIDAK-ADA');
  assert(!badDelete.success, 'Tes F6: Hapus ID yang tidak ada ditolak');

  // 4. Validasi kalkulasi filter 'Semua' atau 'Semua Periode'
  const summaryAll = calculateSummary(dataE.pengeluaran, dataE.subsidi, dataE.kategori, 'Semua Periode');
  // Total subsidi semua = 1jt (Jumadal Ula) + 750k (Jumadal Akhir) = 1.750.000
  assert(summaryAll.totalSubsidi === 1750000, 'Tes F7: Filter "Semua Periode" menjumlahkan seluruh periode tanpa error', `Aktual: ${summaryAll.totalSubsidi}`);

  // =========================================================================
  // TES G — Fitur Catat & Pengelolaan Kategori Kegiatan
  // =========================================================================
  console.log('\n📌 TES G — Fitur Catat & Pengelolaan Kategori Kegiatan');
  console.log('   Spesifikasi: Kategori bawaan selalu ada, tambah kategori baru, pencocokan toleran LBM\n');

  // 1. Verifikasi kategori bawaan selalu tersedia
  const dataG1 = await getAllData();
  const hasLBM = dataG1.kategori.some(k => k.namaKategori.includes('LBM'));
  const hasTFQ = dataG1.kategori.some(k => k.namaKategori.includes('Tafaquh'));
  const hasMSY = dataG1.kategori.some(k => k.namaKategori.includes('Musyawaroh'));
  assert(hasLBM && hasTFQ && hasMSY, 'Tes G1: Seluruh kategori bawaan (LBM, TFQ, MSY) selalu tersedia');

  // 2. Tambah kategori kegiatan baru
  const newCatRes = await addKategori('Takmir Masjid');
  assert(newCatRes.success === true, 'Tes G2: Berhasil menambahkan kategori kegiatan baru "Takmir Masjid"');

  // 3. Catat subsidi untuk kategori baru
  const subNewCat = await addSubsidi({
    kategoriNama: 'Takmir Masjid',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    periodeId: 'Jumadal Ula 1448 H',
    tanggalTransaksi: '2026-10-26',
    nominal: 500000,
    catatan: 'Subsidi Operasional Masjid',
  });
  assert(subNewCat.success === true, 'Tes G3: Berhasil mencatat subsidi untuk kategori baru');

  // 4. Catat pengeluaran untuk kategori baru
  const expNewCat = await addPengeluaran([
    {
      kategoriNama: 'Takmir Masjid',
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      periodeId: 'Jumadal Ula 1448 H',
      tanggalTransaksi: '2026-10-26',
      jenisAcara: 'Kebersihan Masjid',
      namaBarang: 'Alat Kebersihan & Pewangi',
      jumlah: 2,
      satuan: 'paket',
      hargaSatuan: 100000,
      total: 200000,
    },
  ]);
  assert(expNewCat.success === true, 'Tes G4: Berhasil mencatat pengeluaran untuk kategori baru');

  // 5. Verifikasi ringkasan saldo per kategori
  const dataG2 = await getAllData();
  const summaryG = calculateSummary(dataG2.pengeluaran, dataG2.subsidi, dataG2.kategori, 'Jumadal Ula 1448 H');
  const catTakmir = summaryG.categories.find(c => c.kategoriNama === 'Takmir Masjid');
  assert(Boolean(catTakmir), 'Tes G5: Kategori baru muncul di breakdown ringkasan kategori');
  assert(catTakmir && catTakmir.totalSubsidi === 500000, 'Tes G6: Total subsidi kategori Takmir Masjid = Rp 500.000', `Aktual: ${catTakmir?.totalSubsidi}`);
  assert(catTakmir && catTakmir.totalPengeluaran === 200000, 'Tes G7: Total pengeluaran kategori Takmir Masjid = Rp 200.000', `Aktual: ${catTakmir?.totalPengeluaran}`);
  assert(catTakmir && catTakmir.saldoTersisa === 300000, 'Tes G8: Saldo tersisa kategori Takmir Masjid = Rp 300.000 (500k - 200k)', `Aktual: ${catTakmir?.saldoTersisa}`);

  // 6. Uji toleransi pencocokan singkatan "LBM" vs "LBM (Lajnah Bahtsul Masail)"
  const lbmMatch = matchCategory('LBM', { namaKategori: 'LBM (Lajnah Bahtsul Masail)', id: 'KAT-LBM' });
  assert(lbmMatch === true, 'Tes G9: Toleransi pencocokan kategori singkatan "LBM" ke "LBM (Lajnah Bahtsul Masail)" sukses');

  console.log('\n==========================================================');
  console.log(`HASIL AKHIR PENGUJIAN: ${passCount} LULUS, ${failCount} GAGAL`);
  console.log('==========================================================\n');

  // Bersihkan database file dan memory setelah selesai pengujian agar tidak mengotori aplikasi pengguna
  if (typeof resetLocalDbForTesting === 'function') {
    resetLocalDbForTesting();
  }
  const cleanDb = {
    pengeluaran: [],
    subsidi: [],
    periode: [
      {
        id: 'PER-1448-JU',
        namaBulanHijriah: 'Jumadal Ula',
        tahunHijriah: '1448',
        labelPeriode: 'Jumadal Ula 1448 H',
        statusAktif: true,
        createdAt: '2026-10-27T00:00:00.000Z',
      },
    ],
    kategori: [
      {
        id: 'KAT-LBM',
        namaKategori: 'LBM (Lajnah Bahtsul Masail)',
        statusAktif: true,
        createdAt: '2026-10-27T00:00:00.000Z',
        updatedAt: '2026-10-27T00:00:00.000Z',
        iconName: 'menu_book',
      },
      {
        id: 'KAT-TFQ',
        namaKategori: 'Tafaquh & Mubahitsin',
        statusAktif: true,
        createdAt: '2026-10-27T00:00:00.000Z',
        updatedAt: '2026-10-27T00:00:00.000Z',
        iconName: 'groups',
      },
      {
        id: 'KAT-MSY',
        namaKategori: 'Musyawaroh',
        statusAktif: true,
        createdAt: '2026-10-27T00:00:00.000Z',
        updatedAt: '2026-10-27T00:00:00.000Z',
        iconName: 'forum',
      },
    ],
  };
  try {
    fs.writeFileSync(dbPath, JSON.stringify(cleanDb, null, 2), 'utf-8');
  } catch (e) {}

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
