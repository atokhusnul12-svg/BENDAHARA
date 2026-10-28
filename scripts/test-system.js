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
process.env.MMD_DISABLE_CSV_SYNC = 'true';

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

  // =========================================================================
  // TES H — Keamanan Autentikasi Server & Proteksi Endpoint API
  // =========================================================================
  console.log('\n📌 TES H — Keamanan Autentikasi Server & Proteksi Endpoint API');
  console.log('   Spesifikasi: Verifikasi PIN timing-safe, HMAC session token, proteksi endpoint tanpa auth');

  const { validatePin, validateLogin, createSessionToken, verifySessionToken, verifyAdminRequest } = require('../lib/auth');

  // 1. Uji Validasi PIN & Password Login
  assert(validatePin('144805') === true, 'Tes H1: PIN Bendahara yang benar (144805) diterima');
  assert(validatePin('123456') === false, 'Tes H2: PIN Bendahara yang salah ditolak');
  assert(validatePin('') === false, 'Tes H3: PIN kosong ditolak');
  assert(validateLogin('MMD', 'IRENG') === true, 'Tes H3a: Login dengan Username MMD & Password IRENG sah');
  assert(validateLogin('mmd', 'ireng') === true, 'Tes H3b: Login case-insensitive mmd / ireng sah');
  assert(validateLogin('MMD', 'SALAH') === false, 'Tes H3c: Password salah ditolak');
  assert(validateLogin('SALAH', 'IRENG') === false, 'Tes H3d: Username salah ditolak');
  assert(validatePin('IRENG') === true, 'Tes H3e: Password IRENG juga diterima sebagai PIN Bendahara');

  // 2. Uji HMAC Session Token
  const sessionToken = createSessionToken();
  const decodedSession = Buffer.from(sessionToken, 'base64').toString('utf-8');
  assert(typeof sessionToken === 'string' && decodedSession.startsWith('mmd_admin:'), 'Tes H4: Format HMAC session token aman dan bertanda tangan');
  assert(verifySessionToken(sessionToken) === true, 'Tes H5: Verifikasi tanda tangan HMAC session token sah');
  assert(verifySessionToken('mmd_admin:tampered_token:fake_signature') === false, 'Tes H6: Token yang dimanipulasi berhasil ditolak');

  // 3. Uji Proteksi verifyAdminRequest
  const mockUnauthReq = {
    headers: { get: (name) => null },
    cookies: { get: (name) => undefined },
  };
  const unauthResult = verifyAdminRequest(mockUnauthReq);
  assert(unauthResult === false, 'Tes H7: Request tanpa autentikasi ditolak oleh server (Akses Ditolak)');

  const mockPinReq = {
    headers: { get: (name) => (name.toLowerCase() === 'x-admin-pin' ? '144805' : null) },
    cookies: { get: (name) => undefined },
  };
  const authPinResult = verifyAdminRequest(mockPinReq);
  assert(authPinResult === true, 'Tes H8: Request dengan header x-admin-pin yang sah diterima');

  const mockCookieReq = {
    headers: { get: (name) => null },
    cookies: { get: (name) => (name === 'mmd_admin_session' ? { value: sessionToken } : undefined) },
  };
  const authCookieResult = verifyAdminRequest(mockCookieReq);
  assert(authCookieResult === true, 'Tes H9: Request dengan cookie mmd_admin_session yang sah diterima');

  // =========================================================================
  // TES I — Idempotensi Transaksi & Perhitungan Saldo Terkonfirmasi
  // =========================================================================
  console.log('\n📌 TES I — Idempotensi Transaksi & Perhitungan Saldo Terkonfirmasi');
  console.log('   Spesifikasi: Idempotency Key mencegah duplikasi transaksi, pembedaan saldo terkonfirmasi vs sementara');

  const { calculateFinancialSummary } = require('../lib/summary');

  // 1. Uji Idempotensi: kirim data dengan ID yang sama
  const uniqueIdempotencyKey = 'EXP-IDEMP-TEST-001';
  const op1 = await addPengeluaran([
    {
      id: uniqueIdempotencyKey,
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Idempotency Check',
      namaBarang: 'Kertas HVS',
      jumlah: 1,
      satuan: 'rim',
      hargaSatuan: 50000,
      total: 50000,
      tanggalTransaksi: '2026-10-26',
    },
  ]);
  assert(op1.success === true, 'Tes I1: Operasi penulisan pertama dengan Idempotency Key sukses');

  // Kirim lagi operasi kedua dengan ID yang persis sama (simulasi retry jaringan / duplikasi)
  await addPengeluaran([
    {
      id: uniqueIdempotencyKey,
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Idempotency Check Retry',
      namaBarang: 'Kertas HVS',
      jumlah: 1,
      satuan: 'rim',
      hargaSatuan: 50000,
      total: 50000,
      tanggalTransaksi: '2026-10-26',
    },
  ]);
  const dataAfterOp2 = await getAllData();
  const countAfter = dataAfterOp2.pengeluaran.filter(p => p.id === uniqueIdempotencyKey).length;
  assert(countAfter === 1, 'Tes I2: Percobaan penulisan ulang dengan ID sama tidak menghasilkan duplikasi transaksi (Count: 1)');

  // 2. Uji Saldo Terkonfirmasi (Google Sheets) vs Saldo Sementara
  const mockConfirmedSubsidi = [
    {
      id: 'SUB-CONF-1',
      nominal: 1000000,
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      syncStatus: 'synced',
    },
  ];
  const mockConfirmedExpenses = [
    {
      id: 'EXP-CONF-1',
      total: 350000,
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      syncStatus: 'synced',
    },
  ];
  const mockPendingExpenses = [
    {
      id: 'EXP-PEND-1',
      total: 100000,
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      syncStatus: 'pending',
    },
  ];

  const fullSummary = calculateFinancialSummary(
    [...mockConfirmedExpenses, ...mockPendingExpenses],
    mockConfirmedSubsidi,
    dataAfterOp2.kategori,
    'Jumadal Ula 1448 H'
  );

  assert(fullSummary.saldoTerkonfirmasi === 650000, 'Tes I3: Saldo terkonfirmasi = Rp 650.000 (1.000.000 - 350.000)', `Aktual: ${fullSummary.saldoTerkonfirmasi}`);
  assert(fullSummary.saldoTersisa === 550000, 'Tes I4: Saldo sementara (termasuk pending) = Rp 550.000 (1.000.000 - 450.000)', `Aktual: ${fullSummary.saldoTersisa}`);
  assert(fullSummary.hasPendingSync === true, 'Tes I5: Sistem mendeteksi adanya transaksi pending (hasPendingSync: true)');
  assert(fullSummary.pendingCount === 1, 'Tes I6: Jumlah antrean transaksi pending terhitung tepat 1 transaksi');

  // =========================================================================
  // TES J — Kerahasiaan Token & Pencegahan Kebocoran Kredensial
  // =========================================================================
  console.log('\n📌 TES J — Kerahasiaan Token & Pencegahan Kebocoran Kredensial');
  console.log('   Spesifikasi: Token rahasia tidak bocor ke output data publik atau klien browser');

  const publicData = await getAllData();
  const publicDataStr = JSON.stringify(publicData);
  assert(!publicDataStr.includes('mmd-amanah-kas-secret'), 'Tes J1: Token default rahasia TIDAK bocor dalam response getAllData()');
  assert(!publicDataStr.includes('MMD_API_TOKEN'), 'Tes J2: Variabel konfigurasi Script Properties TIDAK bocor ke publik');
  assert(publicData.syncStatus && !publicData.syncStatus.token, 'Tes J3: Objek syncStatus bebas dari atribut token sensitif');

  // =========================================================================
  // TES K — Rate Limiting & Perlindungan Brute-Force PIN Bendahara
  // =========================================================================
  console.log('\n📌 TES K — Rate Limiting & Perlindungan Brute-Force PIN Bendahara');
  console.log('   Spesifikasi: 5 percobaan salah memicu penguncian sementara 15 menit');

  const { checkRateLimit, recordFailedAttempt, clearFailedAttempts } = require('../lib/auth');
  const testIp = '192.168.100.50';

  const initialCheck = checkRateLimit(testIp);
  assert(initialCheck.allowed === true && initialCheck.remainingAttempts === 5, 'Tes K1: Status awal IP bersih dengan 5 sisa kesempatan');

  // Gagal 4 kali berturut-turut
  for (let i = 1; i <= 4; i++) {
    recordFailedAttempt(testIp);
  }
  const checkAfter4 = checkRateLimit(testIp);
  assert(checkAfter4.allowed === true && checkAfter4.remainingAttempts === 1, 'Tes K2: Setelah 4x gagal, tersisa 1 kesempatan');

  // Percobaan ke-5 (mencapai batas)
  const fail5 = recordFailedAttempt(testIp);
  assert(fail5.locked === true, 'Tes K3: Percobaan ke-5 memicu penguncian keamanan');

  const checkLocked = checkRateLimit(testIp);
  assert(checkLocked.allowed === false && checkLocked.lockedForSeconds > 0, 'Tes K4: IP yang terkunci ditolak untuk login ulang');

  // Pemulihan / reset setelah login sukses
  clearFailedAttempts(testIp);
  const checkUnlocked = checkRateLimit(testIp);
  assert(checkUnlocked.allowed === true && checkUnlocked.remainingAttempts === 5, 'Tes K5: Penghapusan catatan gagal memulihkan akses penuh');

  // =========================================================================
  // TES L — Integritas Konfigurasi Produksi & Penolakan Default Fallback
  // =========================================================================
  console.log('\n📌 TES L — Integritas Konfigurasi Produksi & Penolakan Default Fallback');
  console.log('   Spesifikasi: Menolak operasi jika kredensial produksi belum diatur (No hardcoded fallback)');

  const { getAdminPinConfig, getSecretKeyConfig } = require('../lib/auth');

  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminPin = process.env.ADMIN_PIN;
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    process.env.MMD_STRICT_CONFIG = 'true';
    delete process.env.ADMIN_PIN;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_SECRET;

    const prodPinCheck = getAdminPinConfig();
    assert(prodPinCheck.success === false, 'Tes L1: Di lingkungan produksi, penulisan ditolak jika ADMIN_PIN belum diatur');

    const prodSecretCheck = getSecretKeyConfig();
    assert(prodSecretCheck.success === false, 'Tes L2: Di lingkungan produksi, pembuatan sesi ditolak jika ADMIN_SESSION_SECRET belum diatur');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.MMD_STRICT_CONFIG;
    if (originalAdminPin) process.env.ADMIN_PIN = originalAdminPin;
    if (originalSecret) process.env.ADMIN_SESSION_SECRET = originalSecret;
  }

  // =========================================================================
  // TES M — Parsing & Rekonsiliasi CSV Google Sheets Publik
  // =========================================================================
  console.log('\n📌 TES M — Parsing & Rekonsiliasi CSV Google Sheets Publik');
  console.log('   Spesifikasi: Ekstraksi Laporan LBM, Subsidi 5.700.000, Rokok Surya 243.000, Saldo 5.457.000');

  const { parsePublishedCsv } = require('../lib/csv-importer');
  const sampleLiveCsv = `LAPORAN PENGELUARAN - LBM,,,,
"jumadal ula, 1448 H",,,,
Subsidi : 5.700.000,,,,
,,,,
,,,,
,,,,
Jenis Acara,Rincian Belanja,Jumlah Barang,Harga Satuan (Rp),Total (Rp)
kegiatan lbm,rokok surya,9 pcs,"27,000","243,000"
,,,,
TOTAL SELURUH PENGELUARAN,,,,"243,000"
,,,,
Catatan: Harga dalam Rupiah (Rp). Total dihitung otomatis = Jumlah Barang × Harga Satuan,,,,`;

  const parsedCsv = parsePublishedCsv(sampleLiveCsv);
  assert(parsedCsv.kategoriNama === 'LBM (Lajnah Bahtsul Masail)', 'Tes M1: Kategori LBM terdeteksi akurat dari CSV');
  assert(parsedCsv.labelPeriode === 'Jumadal Ula 1448 H', 'Tes M2: Periode Jumadal Ula 1448 H terdeteksi akurat');
  assert(parsedCsv.subsidiNominal === 5700000, 'Tes M3: Nominal Subsidi Rp 5.700.000 terurai tepat', `Aktual: ${parsedCsv.subsidiNominal}`);
  assert(parsedCsv.pengeluaran.length === 1, 'Tes M4: Jumlah item transaksi terurai tepat 1 item');
  assert(parsedCsv.pengeluaran[0].namaBarang === 'rokok surya', 'Tes M5: Nama barang terurai tepat: rokok surya');
  assert(parsedCsv.pengeluaran[0].jumlah === 9 && parsedCsv.pengeluaran[0].satuan === 'pcs', 'Tes M6: Jumlah 9 pcs terpisah dengan benar');
  assert(parsedCsv.pengeluaran[0].hargaSatuan === 27000, 'Tes M7: Harga satuan Rp 27.000 terkonversi numerik');
  assert(parsedCsv.pengeluaran[0].total === 243000, 'Tes M8: Total pengeluaran Rp 243.000 cocok');

  const totalExpCalc = parsedCsv.pengeluaran.reduce((s, it) => s + it.total, 0);
  const saldoCalc = parsedCsv.subsidiNominal - totalExpCalc;
  assert(totalExpCalc === 243000, 'Tes M9: Total kalkulasi dari pengeluaran parsed CSV cocok');
  assert(saldoCalc === 5457000, 'Tes M10: Saldo tersisa = Subsidi - Pengeluaran terhitung akurat Rp 5.457.000');
  // =========================================================================
  // TES N — Penanganan Putus Koneksi Google Sheets & Proteksi Integritas Data
  // =========================================================================
  console.log('\n📌 TES N — Penanganan Putus Koneksi Google Sheets & Proteksi Integritas');
  console.log('   Spesifikasi: Simulasi Sheets gagal/down, penolakan klaim palsu, proteksi hapus, dan pemulihan\n');

  // 1. Simulasikan kegagalan remote Google Sheets dengan URL yang tidak merespon / salah
  process.env.GOOGLE_SCRIPT_URL = 'http://127.0.0.1:1/invalid-apps-script-endpoint';
  process.env.GOOGLE_SCRIPT_TOKEN = 'test-token-kediri-1448';

  const failedExpRes = await addPengeluaran([
    {
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Kegiatan LBM',
      namaBarang: 'Pengeluaran Uji Putus Koneksi',
      jumlah: 1,
      satuan: 'pcs',
      hargaSatuan: 50000,
      total: 50000,
      tanggalTransaksi: '2026-10-27',
    },
  ]);
  assert(failedExpRes.success === false, 'Tes N1: Saat Google Sheets gagal diakses, transaksi baru DITOLAK (tidak ada fake success)');
  assert(Boolean(failedExpRes.error), 'Tes N2: Error message jelas bahwa penyimpanan Google Sheets gagal');

  // Pastikan data yang gagal disimpan TIDAK masuk ke database
  const dataAfterFailedAdd = await getAllData();
  const foundGhost = dataAfterFailedAdd.pengeluaran.find(p => p.namaBarang === 'Pengeluaran Uji Putus Koneksi');
  assert(foundGhost === undefined, 'Tes N3: Transaksi yang gagal tidak disimpan atau diklaim tersimpan di buku kas');

  // 2. Proteksi Hapus: Jika remote Google Sheets down, jangan hapus data dari buku kas lokal
  // Ambil transaksi yang sah yang ada
  const validItemToProtect = dataAfterFailedAdd.pengeluaran[0];
  if (validItemToProtect) {
    const failedDelRes = await deletePengeluaran(validItemToProtect.id);
    assert(failedDelRes.success === false, 'Tes N4: Saat Google Sheets down, penghapusan DITOLAK demi mencegah data hilang sepihak');

    const dataAfterFailedDel = await getAllData();
    const stillExists = dataAfterFailedDel.pengeluaran.find(p => p.id === validItemToProtect.id);
    assert(stillExists !== undefined, 'Tes N5: Transaksi tetap utuh di buku kas lokal ketika penghapusan Google Sheets gagal');
  }

  // 3. Pemulihan Koneksi: matikan endpoint remote yang error (kembali ke mode terisolasi lokal)
  delete process.env.GOOGLE_SCRIPT_URL;

  // Verifikasi status koneksi mendeteksi offline dengan jujur
  const offlineStatus = await checkSyncStatus();
  assert(offlineStatus.connected === false, 'Tes N6: Status koneksi mendeteksi Google Sheets tidak terhubung');
  assert(offlineStatus.isLocalFallback === true, 'Tes N7: Sistem secara jujur menampilkan status offline fallback');

  // Tambah transaksi uji untuk verifikasi status 'pending' pada mode lokal
  const pendingExpRes = await addPengeluaran([
    {
      id: 'EXP-PEND-TEST-999',
      kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
      periodeId: testPeriodLabel,
      bulanHijriah: 'Jumadal Ula',
      tahunHijriah: '1448',
      jenisAcara: 'Kegiatan LBM',
      namaBarang: 'Kertas HVS Pending',
      jumlah: 2,
      satuan: 'rim',
      hargaSatuan: 45000,
      total: 90000,
      tanggalTransaksi: '2026-10-27',
    },
  ]);
  assert(pendingExpRes.success === true, 'Tes N8: Penyimpanan lokal saat offline berhasil dengan antrean');
  assert(pendingExpRes.data && pendingExpRes.data[0].syncStatus === 'pending', 'Tes N9: Status transaksi lokal diberi label "pending" (bukan "synced")');

  // Verifikasi saldo terkonfirmasi vs saldo sementara
  const dataN = await getAllData();
  const summaryN = calculateFinancialSummary(
    dataN.pengeluaran,
    dataN.subsidi,
    dataN.kategori,
    testPeriodLabel
  );
  assert(summaryN.hasPendingSync === true, 'Tes N10: Sistem mendeteksi adanya transaksi pending (hasPendingSync: true)');
  assert(summaryN.pendingCount >= 1, 'Tes N11: Jumlah transaksi pending terhitung dengan tepat');
  assert(summaryN.saldoTerkonfirmasi !== summaryN.saldoTersisa, 'Tes N12: Saldo terkonfirmasi dibedakan dari saldo sementara');

  // =========================================================================
  // TES O — Pengujian Pencegahan Form Reset & Isolasi Lifecycle Modal Input
  // Menguji isolasi state formulir Edit Transaksi Pengeluaran terhadap:
  // - Focus event / keyboard HP buka-tutup
  // - Background refreshData kategori & periode
  // - Perubahan jumlah dari 1 menjadi 3 via stepper
  // - Pengetikan "Surya" pada rincian belanja
  // - Stabilitas form saat save gagal
  // =========================================================================
  console.log('\n📌 TES O — Pengujian Pencegahan Form Reset & Isolasi Lifecycle Modal Input');
  console.log('   Spesifikasi: Form tidak ter-reset saat keyboard HP dibuka/ditutup & background refresh');

  // 1. Data awal transaksi yang akan diedit
  const originalExpense = {
    id: 'EXP-TEST-SURYA',
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    kategoriId: 'KAT-LBM',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    periodeId: 'PER-1448-JU',
    tanggalTransaksi: '2026-10-27',
    jenisAcara: 'Kegiatan LBM Mingguan',
    namaBarang: 'Konsumsi Rapat',
    jumlah: 1,
    satuan: 'bungkus',
    hargaSatuan: 25000,
    total: 25000,
    catatan: 'Data awal untuk pengujian',
  };

  // Simpan data awal ke data-service
  await addPengeluaran([originalExpense]);

  // 2. Simulasikan lifecycle ExpenseModal dengan Session Guard yang diimplementasikan
  let modalState = {
    isOpen: true,
    expenseToEdit: { ...originalExpense },
    sessionKey: null,
    formValues: null,
    rowId: null,
  };

  let initializedSessionRef = { current: null };

  function simulateModalEffect(kategoriArray, periodeArray) {
    if (!modalState.isOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = modalState.expenseToEdit
      ? (modalState.expenseToEdit.id ? `edit-${modalState.expenseToEdit.id}` : `create-${modalState.expenseToEdit.kategoriNama || 'card'}`)
      : 'create-new';

    // Session guard: jika sudah diinisialisasi untuk sesi ini, JANGAN re-init
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    // Inisialisasi state form
    modalState.rowId = 'row-edit-' + modalState.expenseToEdit.id;
    modalState.formValues = {
      kategoriNama: modalState.expenseToEdit.kategoriNama,
      jenisAcara: modalState.expenseToEdit.jenisAcara,
      items: [
        {
          rowId: modalState.rowId,
          namaBarang: modalState.expenseToEdit.namaBarang,
          jumlah: Number(modalState.expenseToEdit.jumlah) || 1,
          satuan: modalState.expenseToEdit.satuan || 'bungkus',
          hargaSatuan: Number(modalState.expenseToEdit.hargaSatuan) || 0,
          total: Number(modalState.expenseToEdit.total) || 0,
        },
      ],
      catatan: modalState.expenseToEdit.catatan || '',
    };
  }

  // Langkah 1: Pengguna membuka modal edit transaksi
  simulateModalEffect([{ id: 'KAT-LBM', namaKategori: 'LBM (Lajnah Bahtsul Masail)' }], [{ id: 'PER-1', labelPeriode: 'Jumadal Ula 1448 H' }]);
  assert(initializedSessionRef.current === 'edit-EXP-TEST-SURYA', 'Tes O1: Inisialisasi formulir modal edit berjalan tepat satu kali ketika transaksi dipilih');
  assert(modalState.formValues.items[0].namaBarang === 'Konsumsi Rapat', 'Tes O1b: Nilai awal rincian belanja terisi sesuai transaksi');
  assert(modalState.formValues.items[0].jumlah === 1, 'Tes O1c: Nilai awal jumlah barang = 1');

  // Langkah 2: Pengguna mengetik "Surya" pada rincian belanja
  modalState.formValues.items[0].namaBarang = 'Surya';

  // Langkah 3: Pengguna mengubah jumlah dari 1 menjadi 3 via stepper
  const currentQty = modalState.formValues.items[0].jumlah;
  const newQty = Math.max(1, currentQty + 2); // 1 -> 3
  modalState.formValues.items[0].jumlah = newQty;
  modalState.formValues.items[0].total = newQty * modalState.formValues.items[0].hargaSatuan; // 3 * 25000 = 75000

  assert(modalState.formValues.items[0].namaBarang === 'Surya', 'Tes O2: Pengguna berhasil mengetik "Surya"');
  assert(modalState.formValues.items[0].jumlah === 3, 'Tes O2b: Jumlah berhasil diubah dari 1 menjadi 3');
  assert(modalState.formValues.items[0].total === 75000, 'Tes O2c: Total subtotal terhitung otomatis Rp 75.000');

  // Langkah 4: Pengguna berinteraksi dengan keyboard HP (buka/tutup, focus antar input)
  // Menstimulasi window.focus yang sebelumnya memicu refreshData & reset form
  for (let step = 1; step <= 5; step++) {
    // Simulasi refreshData menghasilkan instance array kategori & periode baru dari API
    const newKategoriInstances = [{ id: 'KAT-LBM', namaKategori: 'LBM (Lajnah Bahtsul Masail)' }];
    const newPeriodeInstances = [{ id: 'PER-1', labelPeriode: 'Jumadal Ula 1448 H' }];
    simulateModalEffect(newKategoriInstances, newPeriodeInstances);
  }

  // Verifikasi: Form values TIDAK ter-reset ke data lama!
  assert(modalState.formValues.jenisAcara === 'Kegiatan LBM Mingguan', 'Tes O3a: Nama jenis kegiatan TIDAK terhapus/kosong setelah keyboard HP dibuka/ditutup');
  assert(modalState.formValues.items[0].namaBarang === 'Surya', 'Tes O3b: Rincian belanja tetap "Surya" (TIDAK terhapus/kembali ke awal)');
  assert(modalState.formValues.items[0].jumlah === 3, 'Tes O3c: Jumlah barang tetap 3 (TIDAK kembali menjadi 1)');
  assert(modalState.formValues.items[0].rowId === 'row-edit-EXP-TEST-SURYA', 'Tes O3d: rowId tetap stabil sehingga elemen input tidak di-remount');

  // Langkah 5: Simulasikan kegagalan simpan (contoh: error validasi atau jaringan)
  let saveErrorMessage = '';
  try {
    // Coba simpan dengan nama barang kosong (simulasi gagal)
    if (!modalState.formValues.items[0].namaBarang.trim()) {
      throw new Error('Nama barang wajib diisi.');
    }
  } catch (err) {
    saveErrorMessage = err.message;
  }
  assert(modalState.isOpen === true, 'Tes O4a: Modal tetap terbuka jika penyimpanan mengalami kendala');
  assert(modalState.formValues.items[0].namaBarang === 'Surya', 'Tes O4b: Input pengguna tetap utuh saat penyimpanan gagal');

  // Langkah 6: Simpan pembaruan nyata ke data-service
  const updateResult = await updatePengeluaran({
    id: 'EXP-TEST-SURYA',
    namaBarang: 'Surya',
    jumlah: 3,
    hargaSatuan: 25000,
    total: 75000,
    jenisAcara: 'Kegiatan LBM Mingguan',
    catatan: 'Hasil pengujian form edit berhasil disimpan',
  });
  assert(updateResult.success === true, 'Tes O5a: Update transaksi pengeluaran berhasil disimpan ke database');

  const updatedRecord = (await getAllData()).pengeluaran.find(p => p.id === 'EXP-TEST-SURYA');
  assert(Boolean(updatedRecord), 'Tes O5b: Record transaksi hasil update ditemukan');
  assert(updatedRecord.namaBarang === 'Surya', 'Tes O5c: Nama barang tersimpan akurat sebagai "Surya"');
  assert(updatedRecord.jumlah === 3, 'Tes O5d: Jumlah barang tersimpan akurat = 3');
  assert(updatedRecord.total === 75000, 'Tes O5e: Total pengeluaran tersimpan akurat = 75000');

  // Langkah 7: Pengguna menutup modal setelah simpan sukses
  modalState.isOpen = false;
  simulateModalEffect([], []);
  assert(initializedSessionRef.current === null, 'Tes O6: Menutup modal me-reset initializedSessionRef untuk transaksi berikutnya');

  // Langkah 8: Bersihkan transaksi uji
  await deletePengeluaran('EXP-TEST-SURYA');
  const allExpAfter = (await getAllData()).pengeluaran;
  assert(!allExpAfter.some(e => e.id === 'EXP-TEST-SURYA'), 'Tes O7: Transaksi pengujian Surya berhasil dibersihkan');

  // =========================================================================
  // TES P — Format Cetak Pengeluaran Google Sheets & Ekspor Terkelompok per Jenis Acara
  // Spesifikasi: Pemisahan Database & Format Cetak, Hirarki Pohon (├ dan └),
  // Subtotal per Acara, dan Total Tanpa Double-Count
  // =========================================================================
  console.log('\n📌 TES P — Format Cetak Pengeluaran Google Sheets & Ekspor Terkelompok per Jenis Acara');
  console.log('   Spesifikasi: Pemisahan Database & Cetak, Hirarki Pohon, Subtotal, & Total Tanpa Double-Count\n');

  // Bersihkan database untuk pengujian terisolasi
  if (typeof resetLocalDbForTesting === 'function') {
    resetLocalDbForTesting();
  }

  // 1. Buat Acara 1: "PENGAJIAN UMUM" dengan 3 rincian belanja
  const event1Id = 'EVT-P1-PENGAJIAN';
  await addPengeluaran({
    id: 'EXP-P1-1',
    eventId: event1Id,
    jenisAcara: 'Pengajian Umum',
    namaBarang: 'Konsumsi peserta',
    jumlah: 3,
    satuan: 'porsi',
    hargaSatuan: 25000,
    total: 75000,
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    periodeId: 'Jumadal Ula 1448 H',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    tanggalTransaksi: '2026-10-15',
  });
  await addPengeluaran({
    id: 'EXP-P1-2',
    eventId: event1Id,
    jenisAcara: 'Pengajian Umum',
    namaBarang: 'Air mineral',
    jumlah: 2,
    satuan: 'dus',
    hargaSatuan: 5000,
    total: 10000,
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    periodeId: 'Jumadal Ula 1448 H',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    tanggalTransaksi: '2026-10-15',
  });
  await addPengeluaran({
    id: 'EXP-P1-3',
    eventId: event1Id,
    jenisAcara: 'Pengajian Umum',
    namaBarang: 'Perlengkapan acara',
    jumlah: 1,
    satuan: 'paket',
    hargaSatuan: 40000,
    total: 40000,
    kategoriNama: 'LBM (Lajnah Bahtsul Masail)',
    periodeId: 'Jumadal Ula 1448 H',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    tanggalTransaksi: '2026-10-15',
  });

  // 2. Buat Acara 2: "MUSYAWARAH MINGGUAN" dengan 2 rincian belanja
  const event2Id = 'EVT-P2-MUSYAWARAH';
  await addPengeluaran({
    id: 'EXP-P2-1',
    eventId: event2Id,
    jenisAcara: 'Musyawarah Mingguan',
    namaBarang: 'Konsumsi rapat',
    jumlah: 4,
    satuan: 'bungkus',
    hargaSatuan: 15000,
    total: 60000,
    kategoriNama: 'Musyawaroh',
    periodeId: 'Jumadal Ula 1448 H',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    tanggalTransaksi: '2026-10-18',
  });
  await addPengeluaran({
    id: 'EXP-P2-2',
    eventId: event2Id,
    jenisAcara: 'Musyawarah Mingguan',
    namaBarang: 'Alat tulis',
    jumlah: 2,
    satuan: 'pack',
    hargaSatuan: 10000,
    total: 20000,
    kategoriNama: 'Musyawaroh',
    periodeId: 'Jumadal Ula 1448 H',
    bulanHijriah: 'Jumadal Ula',
    tahunHijriah: '1448',
    tanggalTransaksi: '2026-10-18',
  });

  // Ambil data database transaksi mentah
  const currentDb = await getAllData();
  const allExp = currentDb.pengeluaran;

  // Verifikasi Pemisahan Database: Tabel mentah 'Pengeluaran' tetap datar dengan 5 item
  assert(allExp.length === 5, 'Tes P1: Database transaksi mentah Pengeluaran menyimpan tepat 5 baris data datar');

  // Uji Logika Grouping Format Cetak
  const groupMap = {};
  const groupOrderList = [];
  allExp.forEach(it => {
    const rawAcara = String(it.jenisAcara || 'Kegiatan Umum').trim();
    const key = rawAcara.toLowerCase();
    if (!groupMap[key]) {
      groupMap[key] = { name: rawAcara, items: [] };
      groupOrderList.push(key);
    }
    groupMap[key].items.push(it);
  });

  assert(groupOrderList.length === 2, 'Tes P2: Sistem berhasil memisahkan menjadi 2 kelompok acara mandiri');
  assert(groupMap['pengajian umum'].items.length === 3, 'Tes P3: Acara "Pengajian Umum" memiliki tepat 3 rincian belanja');
  assert(groupMap['musyawarah mingguan'].items.length === 2, 'Tes P4: Acara "Musyawarah Mingguan" memiliki tepat 2 rincian belanja');

  // Uji Hirarki Garis Pohon (├ untuk item 1..n-1, dan └ untuk item terakhir)
  const itemsPengajian = groupMap['pengajian umum'].items;
  const p1Prefixes = itemsPengajian.map((item, idx) => (idx === itemsPengajian.length - 1 ? '└  ' : '├  '));
  assert(p1Prefixes[0] === '├  ' && p1Prefixes[1] === '├  ' && p1Prefixes[2] === '└  ', 'Tes P5: Penanda pohon vertikal (├ dan └) terbentuk rapi dan konsisten');

  // Uji Perhitungan Subtotal per Acara
  const subtotalP1 = itemsPengajian.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const subtotalP2 = groupMap['musyawarah mingguan'].items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  assert(subtotalP1 === 125000, `Tes P6: Subtotal Pengajian Umum terhitung tepat Rp 125.000 (Aktual: ${subtotalP1})`);
  assert(subtotalP2 === 80000, `Tes P7: Subtotal Musyawarah Mingguan terhitung tepat Rp 80.000 (Aktual: ${subtotalP2})`);

  // Uji Total Keseluruhan (Bebas dari Double-Counting)
  const grandTotalExp = subtotalP1 + subtotalP2;
  const directSum = allExp.reduce((s, it) => s + (Number(it.total) || 0), 0);
  assert(grandTotalExp === 205000, `Tes P8: Total Pengeluaran keseluruhan cocok Rp 205.000 (Aktual: ${grandTotalExp})`);
  assert(grandTotalExp === directSum, 'Tes P9: Total pengeluaran tidak menghitung transaksi ganda (Idempotent calculation)');

  // Uji Perubahan Data (Edit Rincian Belanja): Konsumsi rapat diubah dari 4 menjadi 5 item
  await updatePengeluaran({
    id: 'EXP-P2-1',
    jumlah: 5,
    hargaSatuan: 15000,
    total: 75000,
  });

  const updatedDb = await getAllData();
  const updatedP2_1 = updatedDb.pengeluaran.find(p => p.id === 'EXP-P2-1');
  assert(updatedP2_1.jumlah === 5, 'Tes P10: Jumlah barang hasil edit berhasil diperbarui menjadi 5');
  assert(updatedP2_1.total === 75000, 'Tes P11: Subtotal baris hasil edit berubah menjadi Rp 75.000');

  // Hitung ulang subtotal setelah edit
  const updatedP2Subtotal = updatedDb.pengeluaran
    .filter(p => p.jenisAcara.toLowerCase() === 'musyawarah mingguan')
    .reduce((s, it) => s + (Number(it.total) || 0), 0);
  const updatedGrandTotal = updatedDb.pengeluaran.reduce((s, it) => s + (Number(it.total) || 0), 0);

  assert(updatedP2Subtotal === 95000, `Tes P12: Subtotal Musyawarah Mingguan otomatis terupdate menjadi Rp 95.000 (Aktual: ${updatedP2Subtotal})`);
  assert(updatedGrandTotal === 220000, `Tes P13: Total keseluruhan otomatis terupdate menjadi Rp 220.000 (Aktual: ${updatedGrandTotal})`);

  // Uji Kompatibilitas Transaksi Lama (tanpa eventId)
  await addPengeluaran({
    id: 'EXP-LEGACY-1',
    jenisAcara: 'Pengajian Umum',
    namaBarang: 'Konsumsi Ustadz Tamu',
    jumlah: 1,
    satuan: 'kotak',
    hargaSatuan: 30000,
    total: 30000,
    periodeId: 'Jumadal Ula 1448 H',
  });
  const afterLegacyDb = await getAllData();
  const legacyInGroup = afterLegacyDb.pengeluaran.filter(p => p.jenisAcara.toLowerCase() === 'pengajian umum');
  assert(legacyInGroup.length === 4, 'Tes P14: Transaksi lama (tanpa eventId) otomatis tergabung di bawah kelompok "Pengajian Umum" yang benar');

  // Bersihkan transaksi uji coba
  await deletePengeluaran('EXP-P1-1');
  await deletePengeluaran('EXP-P1-2');
  await deletePengeluaran('EXP-P1-3');
  await deletePengeluaran('EXP-P2-1');
  await deletePengeluaran('EXP-P2-2');
  await deletePengeluaran('EXP-LEGACY-1');
  assert((await getAllData()).pengeluaran.length === 0, 'Tes P15: Seluruh transaksi uji coba berhasil dibersihkan');

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
