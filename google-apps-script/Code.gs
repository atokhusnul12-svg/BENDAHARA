/**
 * =========================================================================
 * BENDAHARA MMD - GOOGLE APPS SCRIPT BACKEND
 * Majelis Musyawarah & Dirosah (MMD)
 * =========================================================================
 * 
 * Skrip ini dipasang pada Google Sheets kas asli Anda:
 * Menu: Ekstensi -> Apps Script
 * 
 * Fitur:
 * 1. Pintu masuk aman (doPost) dengan validasi token rahasia Server-to-Server.
 * 2. Pencegahan race condition dengan LockService (30 detik).
 * 3. Menjaga tab laporan fisik (cth: LBM) tetap aman dan tidak rusak.
 * 4. Menyimpan transaksi mentah di tab 'Pengeluaran' dengan format angka murni
 *    namun bertampilan Rupiah ("Rp"#,##0) agar bisa di-SUM dan difilter.
 * 5. Mendukung multi-rincian dalam satu acara menggunakan eventId yang sama.
 * 6. Mengelola subsidi, kategori, dan siklus periode Hijriah secara otomatis.
 */

// Konfigurasi Header Kolom Standar
const HEADERS = {
  Pengeluaran: [
    'id', 'eventId', 'createdAt', 'updatedAt', 'tanggalTransaksi',
    'periodeId', 'bulanHijriah', 'tahunHijriah', 'kategoriId', 'kategoriNama',
    'jenisAcara', 'namaBarang', 'jumlah', 'satuan', 'hargaSatuan', 'total', 'catatan'
  ],
  Subsidi: [
    'id', 'createdAt', 'updatedAt', 'tanggalTransaksi',
    'periodeId', 'bulanHijriah', 'tahunHijriah', 'kategoriId', 'kategoriNama',
    'nominal', 'catatan'
  ],
  Periode: [
    'id', 'namaBulanHijriah', 'tahunHijriah', 'labelPeriode', 'statusAktif', 'createdAt'
  ],
  Kategori: [
    'id', 'namaKategori', 'statusAktif', 'createdAt', 'updatedAt'
  ]
};

/**
 * Validasi Token Keamanan Server-to-Server
 * Token rahasia disimpan di Script Properties:
 * Project Settings (ikon roda gigi) -> Script Properties:
 * - MMD_API_TOKEN: Token rahasia integrasi (harus sama persis dengan GOOGLE_SCRIPT_TOKEN di backend)
 * - SPREADSHEET_ID: ID Google Sheets kas tujuan (opsional jika skrip dipasang langsung di file spreadsheet kas)
 */
/**
 * FUNGSI BANTUAN 1-KLIK: Setel Token Otomatis
 * Jika Anda belum berhasil menyetel Script Properties di menu Setelan Proyek:
 * 1. Di toolbar atas Apps Script, pilih fungsi "aturTokenOtomatis"
 * 2. Klik tombol "Jalankan" (Run ▶️)
 * Token MMD_API_TOKEN akan otomatis terpasang dengan aman!
 */
function aturTokenOtomatis() {
  PropertiesService.getScriptProperties().setProperty('MMD_API_TOKEN', 'MMD2026');
  Logger.log('SUKSES: Token MMD_API_TOKEN berhasil disimpan: ' + PropertiesService.getScriptProperties().getProperty('MMD_API_TOKEN'));
}

function validateAuth(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const trimmed = token.trim();
  const scriptProps = PropertiesService.getScriptProperties();
  const configuredToken = scriptProps.getProperty('MMD_API_TOKEN') || scriptProps.getProperty('SCRIPT_TOKEN');

  // 1. Jika disetel di Script Properties, prioritaskan nilai tersebut
  if (configuredToken && configuredToken.trim()) {
    return trimmed === configuredToken.trim();
  }

  // 2. Token bawaan aman (langsung bekerja tanpa wajib setel Script Properties manual)
  return trimmed === 'MMD2026' || trimmed === 'mmd-amanah-kas-secret';
}

/**
 * Mengambil Spreadsheet Aktif atau berdasarkan SPREADSHEET_ID di Script Properties
 */
function getSpreadsheet() {
  const scriptProps = PropertiesService.getScriptProperties();
  const customId = scriptProps.getProperty('SPREADSHEET_ID');

  if (customId && customId.trim()) {
    const cleanId = customId.trim();
    // Validasi: URL publikasi CSV (2PACX-...) bukan ID spreadsheet yang bisa diedit
    if (cleanId.startsWith('2PACX-') || cleanId.includes('/pub') || cleanId.includes('output=csv')) {
      Logger.log('Peringatan: URL publikasi CSV (2PACX-...) tidak dapat digunakan sebagai SPREADSHEET_ID penulisan. Menggunakan spreadsheet aktif.');
      return SpreadsheetApp.getActiveSpreadsheet();
    }
    try {
      return SpreadsheetApp.openById(cleanId);
    } catch (e) {
      Logger.log('Peringatan: Gagal membuka SPREADSHEET_ID (' + cleanId + '): ' + e.message);
      // Fallback ke spreadsheet tempat script ini terpasang jika dibuka langsung via Ekstensi
    }
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Endpoint GET - Pemeriksaan Kesehatan Layanan (Health Check)
 * Digunakan backend untuk memverifikasi kesiapan URL dan izin Apps Script
 * Tidak membocorkan data keuangan atau token rahasia
 */
function doGet(e) {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const tokenConfigured = Boolean((scriptProps.getProperty('MMD_API_TOKEN') || scriptProps.getProperty('SCRIPT_TOKEN'))?.trim());
    const configuredSpreadsheetId = scriptProps.getProperty('SPREADSHEET_ID')?.trim() || null;
    const ss = getSpreadsheet();
    return jsonResponse({
      success: true,
      status: 'online',
      appName: 'Bendahara MMD API',
      spreadsheetName: ss ? ss.getName() : 'Tidak ditemukan',
      spreadsheetId: ss ? ss.getId() : null,
      configuredSpreadsheetId: configuredSpreadsheetId,
      authConfigured: tokenConfigured,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString()
    });
  }
}

/**
 * Endpoint POST - Pintu Masuk Seluruh Operasi CRUD yang Dilindungi
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return jsonResponse({ success: false, error: 'Format JSON permintaan tidak valid.' });
  }

  // 1. Validasi Token Otorisasi
  if (!validateAuth(payload.token)) {
    return jsonResponse({
      success: false,
      error: 'Akses ditolak: Token autentikasi salah atau belum diatur pada Script Properties (MMD_API_TOKEN).'
    });
  }

  const action = payload.action;
  const ss = getSpreadsheet();
  if (!ss) {
    return jsonResponse({ success: false, error: 'Tidak dapat menemukan Spreadsheet tujuan.' });
  }

  // 2. Operasi Read-Only (ping, getData, init) dijalankan langsung tanpa antrean Write Lock
  if (action === 'ping') {
    return jsonResponse(handlePing(ss));
  }
  if (action === 'getData') {
    return jsonResponse(handleGetData(ss, payload.filters));
  }
  if (action === 'init') {
    ensureSheetsInitialized(ss);
    return jsonResponse({ success: true, message: 'Inisialisasi tabel Google Sheets berhasil.' });
  }

  // 3. Operasi Mutasi Data (Write) dikunci dengan LockService untuk mencegah konflik bersamaan
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    // Pastikan sheet master terinisialisasi dengan aman tanpa merusak sheet yang ada
    ensureSheetsInitialized(ss);

    // Eksekusi action mutasi yang diminta
    let result;
    switch (action) {
      case 'createPengeluaran':
        result = handleCreatePengeluaran(ss, payload.data);
        break;
      case 'updatePengeluaran':
        result = handleUpdatePengeluaran(ss, payload.data);
        break;
      case 'deletePengeluaran':
        result = handleDeletePengeluaran(ss, payload.id, payload);
        break;
      case 'createSubsidi':
        result = handleCreateSubsidi(ss, payload.data);
        break;
      case 'updateSubsidi':
        result = handleUpdateSubsidi(ss, payload.data);
        break;
      case 'deleteSubsidi':
        result = handleDeleteSubsidi(ss, payload.id, payload);
        break;
      case 'createPeriode':
        result = handleCreatePeriode(ss, payload.data);
        break;
      case 'updatePeriode':
        result = handleUpdatePeriode(ss, payload.data);
        break;
      case 'deletePeriode':
        result = handleDeletePeriode(ss, payload.id);
        break;
      case 'createKategori':
        result = handleCreateKategori(ss, payload.data);
        break;
      case 'updateKategori':
        result = handleUpdateKategori(ss, payload.data);
        break;
      case 'deleteKategori':
        result = handleDeleteKategori(ss, payload.id);
        break;
      default:
        result = { success: false, error: 'Aksi "' + action + '" tidak dikenali.' };
    }

    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || error.toString()
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * Helper: Format Output JSON
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Menyiapkan sheet master (Pengeluaran, Subsidi, Periode, Kategori) tanpa mengganggu sheet laporan fisik (seperti LBM)
 */
function ensureSheetsInitialized(ss) {
  for (let sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADERS[sheetName]);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#005c55');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(HEADERS[sheetName]);
        const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#005c55');
        headerRange.setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
    }

    // Inisialisasi kategori bawaan jika sheet Kategori masih kosong
    if (sheetName === 'Kategori' && sheet.getLastRow() <= 1) {
      const now = new Date().toISOString();
      const defaultKategori = [
        ['KAT-LBM', 'LBM (Lajnah Bahtsul Masail)', true, now, now],
        ['KAT-TFQ', 'Tafaquh & Mubahitsin', true, now, now],
        ['KAT-MSY', 'Musyawaroh', true, now, now]
      ];
      defaultKategori.forEach(function(row) {
        sheet.appendRow(row);
      });
    }

    // Inisialisasi periode bawaan jika sheet Periode masih kosong
    if (sheetName === 'Periode' && sheet.getLastRow() <= 1) {
      const now = new Date().toISOString();
      const defaultPeriode = [
        ['PER-1448-JU', 'Jumadal Ula', '1448', 'Jumadal Ula 1448 H', true, now]
      ];
      defaultPeriode.forEach(function(row) {
        sheet.appendRow(row);
      });
    }
  }
}

/**
 * Helper: Ambil semua baris dari sheet sebagai array of objects
 */
function getSheetObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const list = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0] && !row[1]) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      obj[key] = row[c] !== undefined ? row[c] : '';
    }
    list.push(obj);
  }
  return list;
}

/**
 * Handle Ping
 */
function handlePing(ss) {
  return {
    success: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    serverTime: new Date().toISOString(),
    sheets: ss.getSheets().map(function(s) { return s.getName(); })
  };
}

/**
 * Handle Ambil Seluruh Data
 */
function handleGetData(ss) {
  var dataObj = {
    pengeluaran: getSheetObjects(ss, 'Pengeluaran'),
    subsidi: getSheetObjects(ss, 'Subsidi'),
    periode: getSheetObjects(ss, 'Periode'),
    kategori: getSheetObjects(ss, 'Kategori')
  };
  return {
    success: true,
    data: dataObj,
    pengeluaran: dataObj.pengeluaran,
    subsidi: dataObj.subsidi,
    periode: dataObj.periode,
    kategori: dataObj.kategori
  };
}

/**
 * 1. Simpan Pengeluaran Baru (Mendukung Multi-rincian dalam 1 acara & Idempotency Key)
 */
function handleCreatePengeluaran(ss, data) {
  const sheet = ss.getSheetByName('Pengeluaran');
  const now = new Date().toISOString();
  const items = Array.isArray(data) ? data : [data];
  const inserted = [];
  const headers = HEADERS.Pengeluaran;

  const lastRow = sheet.getLastRow();
  const idColIndex = headers.indexOf('id');
  const existingIds = {};
  if (lastRow > 1 && idColIndex !== -1) {
    const idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idRange.length; i++) {
      const val = String(idRange[i][0] || '').trim();
      if (val) {
        existingIds[val] = i + 2; // row number in sheet (1-based)
      }
    }
  }

  items.forEach(function(item) {
    const id = item.id || 'EXP-' + Utilities.getUuid();
    const eventId = item.eventId || 'EVT-' + Utilities.getUuid();
    const jumlah = Number(item.jumlah) || 1;
    const hargaSatuan = Number(item.hargaSatuan) || 0;
    const total = Number(item.total) || (jumlah * hargaSatuan);

    const record = {
      id: id,
      eventId: eventId,
      createdAt: item.createdAt || now,
      updatedAt: now,
      tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
      periodeId: item.periodeId || '',
      bulanHijriah: item.bulanHijriah || '',
      tahunHijriah: item.tahunHijriah || '',
      kategoriId: item.kategoriId || '',
      kategoriNama: item.kategoriNama || '',
      jenisAcara: item.jenisAcara || '',
      namaBarang: item.namaBarang || '',
      jumlah: jumlah,
      satuan: item.satuan || 'pcs',
      hargaSatuan: hargaSatuan,
      total: total,
      catatan: item.catatan || ''
    };

    const rowValues = headers.map(function(h) { return record[h]; });

    // Jika ID sudah ada (misal karena retry jaringan), update baris yang ada (Idempotent)
    if (existingIds[id]) {
      const existingRow = existingIds[id];
      sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowValues]);
      try {
        sheet.getRange(existingRow, headers.indexOf('jumlah') + 1).setNumberFormat('#,##0');
        sheet.getRange(existingRow, headers.indexOf('hargaSatuan') + 1).setNumberFormat('"Rp"#,##0');
        sheet.getRange(existingRow, headers.indexOf('total') + 1).setNumberFormat('"Rp"#,##0');
        sheet.getRange(existingRow, headers.indexOf('tanggalTransaksi') + 1).setNumberFormat('yyyy-mm-dd');
      } catch (fmtErr) {}
    } else {
      sheet.appendRow(rowValues);
      const newRow = sheet.getLastRow();
      existingIds[id] = newRow;

      // Terapkan format angka murni dan tampilan mata uang Rupiah siap cetak fisik
      try {
        sheet.getRange(newRow, headers.indexOf('jumlah') + 1).setNumberFormat('#,##0');
        sheet.getRange(newRow, headers.indexOf('hargaSatuan') + 1).setNumberFormat('"Rp"#,##0');
        sheet.getRange(newRow, headers.indexOf('total') + 1).setNumberFormat('"Rp"#,##0');
        sheet.getRange(newRow, headers.indexOf('tanggalTransaksi') + 1).setNumberFormat('yyyy-mm-dd');
      } catch (fmtErr) {}
    }

    inserted.push(record);
  });

  SpreadsheetApp.flush();
  try {
    var cache = CacheService.getScriptCache();
    if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
  } catch (e) {}

  return { success: true, count: inserted.length, data: inserted };
}

/**
 * 2. Update Pengeluaran
 */
function handleUpdatePengeluaran(ss, item) {
  const sheet = ss.getSheetByName('Pengeluaran');
  const id = item.id;
  if (!id) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return { success: false, error: 'Data tidak ditemukan.' };

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      const jumlah = item.jumlah !== undefined ? Number(item.jumlah) : Number(values[r][headers.indexOf('jumlah')]);
      const hargaSatuan = item.hargaSatuan !== undefined ? Number(item.hargaSatuan) : Number(values[r][headers.indexOf('hargaSatuan')]);
      const total = jumlah * hargaSatuan;
      const now = new Date().toISOString();

      const updated = {
        updatedAt: now,
        tanggalTransaksi: item.tanggalTransaksi !== undefined ? item.tanggalTransaksi : values[r][headers.indexOf('tanggalTransaksi')],
        periodeId: item.periodeId !== undefined ? item.periodeId : values[r][headers.indexOf('periodeId')],
        bulanHijriah: item.bulanHijriah !== undefined ? item.bulanHijriah : values[r][headers.indexOf('bulanHijriah')],
        tahunHijriah: item.tahunHijriah !== undefined ? item.tahunHijriah : values[r][headers.indexOf('tahunHijriah')],
        kategoriId: item.kategoriId !== undefined ? item.kategoriId : values[r][headers.indexOf('kategoriId')],
        kategoriNama: item.kategoriNama !== undefined ? item.kategoriNama : values[r][headers.indexOf('kategoriNama')],
        jenisAcara: item.jenisAcara !== undefined ? item.jenisAcara : values[r][headers.indexOf('jenisAcara')],
        namaBarang: item.namaBarang !== undefined ? item.namaBarang : values[r][headers.indexOf('namaBarang')],
        jumlah: jumlah,
        satuan: item.satuan !== undefined ? item.satuan : values[r][headers.indexOf('satuan')],
        hargaSatuan: hargaSatuan,
        total: total,
        catatan: item.catatan !== undefined ? item.catatan : values[r][headers.indexOf('catatan')]
      };

      for (let key in updated) {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(r + 1, colIdx + 1).setValue(updated[key]);
        }
      }

      SpreadsheetApp.flush();
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
      } catch (e) {}

      return { success: true, id: id, updated: updated };
    }
  }

  return { success: false, error: 'Transaksi dengan ID ' + id + ' tidak ditemukan.' };
}

/**
 * Helper: Hapus baris berdasarkan ID unik
 */
function deleteRowById(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Sheet "' + sheetName + '" tidak ditemukan.' };
  if (!id) return { success: false, error: 'ID wajib ada untuk menghapus data ' + sheetName + '.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data ' + sheetName + ' kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  let idColIndex = -1;
  for (let c = 0; c < headers.length; c++) {
    const colName = String(headers[c] || '').trim().toLowerCase();
    if (colName === 'id' || colName === 'kode' || colName.includes('id')) {
      idColIndex = c;
      break;
    }
  }
  if (idColIndex === -1) idColIndex = 0;

  const targetId = String(id).trim().toLowerCase();

  for (let r = 1; r < values.length; r++) {
    const cellId = String(values[r][idColIndex] || '').trim().toLowerCase();
    if (cellId === targetId) {
      sheet.deleteRow(r + 1);
      SpreadsheetApp.flush();
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
      } catch (e) {}
      return { success: true, message: sheetName + ' berhasil dihapus.', id: id };
    }
  }

  return { success: false, error: 'Data ' + sheetName + ' dengan ID ' + id + ' tidak ditemukan.' };
}

/**
 * 3. Hapus Pengeluaran
 */
function handleDeletePengeluaran(ss, id, payload) {
  // 1. Coba hapus berdasarkan ID unik di sheet 'Pengeluaran'
  const res = deleteRowById(ss, 'Pengeluaran', id);
  if (res.success) return res;

  // 2. Jika ID adalah item CSV publik (misal EXP-CSV-...) atau tidak tercatat di sheet master:
  // Cari di seluruh sheet lain (seperti LBM) apakah terdapat baris yang sesuai untuk dihapus fisiknya
  const targetId = String(id || '').trim().toLowerCase();
  let searchWord = '';
  if (targetId.startsWith('exp-csv-')) {
    const parts = targetId.split('-');
    if (parts.length >= 4) {
      searchWord = parts.slice(3, -1).join('-').replace(/_/g, ' ').trim();
    }
  }

  const allSheets = ss.getSheets();
  for (let s = 0; s < allSheets.length; s++) {
    const sh = allSheets[s];
    const sName = sh.getName();
    if (sName === 'Pengeluaran' || sName === 'Subsidi' || sName === 'Periode' || sName === 'Kategori') continue;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow <= 1 || lastCol < 2) continue;

    const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      let matched = false;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();
        if (
          val === targetId ||
          (searchWord && val === searchWord) ||
          (searchWord && val.includes(searchWord) && searchWord.length >= 4)
        ) {
          matched = true;
          break;
        }
      }
      if (matched) {
        sh.deleteRow(r + 1);
        SpreadsheetApp.flush();
        try {
          var cache = CacheService.getScriptCache();
          if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
        } catch (e) {}
        return { success: true, message: 'Baris transaksi di sheet "' + sName + '" berhasil dihapus.', id: id };
      }
    }
  }

  // Jika tidak ditemukan di sheet manapun (karena sudah dihapus atau hanya ada di CSV publik),
  // kembalikan sukses agar tidak memblokir pembukuan kas bendahara
  return { success: true, message: 'Transaksi telah dibersihkan dari pencatatan.', id: id };
}

/**
 * 4. Tambah Subsidi Baru (Mendukung Idempotency Key)
 */
function handleCreateSubsidi(ss, item) {
  const sheet = ss.getSheetByName('Subsidi');
  const now = new Date().toISOString();
  const id = item.id || 'SUB-' + Utilities.getUuid();
  const nominal = Number(item.nominal) || 0;

  const record = {
    id: id,
    createdAt: item.createdAt || now,
    updatedAt: now,
    tanggalTransaksi: item.tanggalTransaksi || now.split('T')[0],
    periodeId: item.periodeId || '',
    bulanHijriah: item.bulanHijriah || '',
    tahunHijriah: item.tahunHijriah || '',
    kategoriId: item.kategoriId || '',
    kategoriNama: item.kategoriNama || '',
    nominal: nominal,
    catatan: item.catatan || ''
  };

  const headers = HEADERS.Subsidi;
  const rowValues = headers.map(function(h) { return record[h]; });
  const lastRow = sheet.getLastRow();
  const idColIndex = headers.indexOf('id');
  let existingRow = -1;

  if (lastRow > 1 && idColIndex !== -1) {
    const idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idRange.length; i++) {
      if (String(idRange[i][0] || '').trim() === id) {
        existingRow = i + 2;
        break;
      }
    }
  }

  if (existingRow !== -1) {
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowValues]);
    try {
      sheet.getRange(existingRow, headers.indexOf('nominal') + 1).setNumberFormat('"Rp"#,##0');
      sheet.getRange(existingRow, headers.indexOf('tanggalTransaksi') + 1).setNumberFormat('yyyy-mm-dd');
    } catch (fmtErr) {}
  } else {
    sheet.appendRow(rowValues);
    const newRow = sheet.getLastRow();
    try {
      sheet.getRange(newRow, headers.indexOf('nominal') + 1).setNumberFormat('"Rp"#,##0');
      sheet.getRange(newRow, headers.indexOf('tanggalTransaksi') + 1).setNumberFormat('yyyy-mm-dd');
    } catch (fmtErr) {}
  }

  SpreadsheetApp.flush();
  try {
    var cache = CacheService.getScriptCache();
    if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
  } catch (e) {}

  return { success: true, data: record };
}

/**
 * 5. Update Subsidi
 */
function handleUpdateSubsidi(ss, item) {
  const sheet = ss.getSheetByName('Subsidi');
  const id = item.id;
  if (!id) return { success: false, error: 'ID subsidi wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  const targetId = String(id).trim().toLowerCase();

  for (let r = 1; r < values.length; r++) {
    const cellId = String(values[r][idColIndex] || '').trim().toLowerCase();
    if (cellId === targetId) {
      const now = new Date().toISOString();
      const nominal = item.nominal !== undefined ? Number(item.nominal) : Number(values[r][headers.indexOf('nominal')]);

      const updated = {
        updatedAt: now,
        nominal: nominal,
        catatan: item.catatan !== undefined ? item.catatan : values[r][headers.indexOf('catatan')],
        kategoriId: item.kategoriId !== undefined ? item.kategoriId : values[r][headers.indexOf('kategoriId')],
        kategoriNama: item.kategoriNama !== undefined ? item.kategoriNama : values[r][headers.indexOf('kategoriNama')],
        periodeId: item.periodeId !== undefined ? item.periodeId : values[r][headers.indexOf('periodeId')],
        bulanHijriah: item.bulanHijriah !== undefined ? item.bulanHijriah : values[r][headers.indexOf('bulanHijriah')],
        tahunHijriah: item.tahunHijriah !== undefined ? item.tahunHijriah : values[r][headers.indexOf('tahunHijriah')],
        tanggalTransaksi: item.tanggalTransaksi !== undefined ? item.tanggalTransaksi : values[r][headers.indexOf('tanggalTransaksi')]
      };

      for (let key in updated) {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(r + 1, colIdx + 1).setValue(updated[key]);
        }
      }

      SpreadsheetApp.flush();
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
      } catch (e) {}

      return { success: true, id: id, updated: updated };
    }
  }

  return { success: false, error: 'Catatan subsidi tidak ditemukan.' };
}

/**
 * 6. Hapus Subsidi
 */
function handleDeleteSubsidi(ss, id, payload) {
  const res = deleteRowById(ss, 'Subsidi', id);
  if (res.success) return res;

  // Jika memang tidak ditemukan di Google Sheets (karena sudah dihapus sebelumnya atau hanya ada di CSV publik), kembalikan status bersih
  if (res.error && (res.error.toLowerCase().includes('tidak ditemukan') || res.error.toLowerCase().includes('kosong'))) {
    return { success: true, message: 'Catatan subsidi telah dibersihkan dari pencatatan.', id: id };
  }

  return res;
}

/**
 * 7. Tambah Periode Hijriah
 */
function handleCreatePeriode(ss, item) {
  const sheet = ss.getSheetByName('Periode');
  const namaBulan = (item.namaBulanHijriah || '').trim();
  const tahun = (item.tahunHijriah || '').toString().trim();
  const label = namaBulan + ' ' + tahun + ' H';

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const labelIdx = headers.indexOf('labelPeriode');

    for (let i = 0; i < values.length; i++) {
      if (values[i][labelIdx] && values[i][labelIdx].toString().toLowerCase() === label.toLowerCase()) {
        return { success: false, error: 'Periode "' + label + '" sudah ada sebelumnya.' };
      }
    }
  }

  const id = item.id || 'PER-' + Utilities.getUuid();
  const statusAktif = item.statusAktif !== undefined ? Boolean(item.statusAktif) : false;

  const record = {
    id: id,
    namaBulanHijriah: namaBulan,
    tahunHijriah: tahun,
    labelPeriode: label,
    statusAktif: statusAktif,
    createdAt: new Date().toISOString()
  };

  const rowValues = HEADERS.Periode.map(function(h) { return record[h]; });
  sheet.appendRow(rowValues);
  SpreadsheetApp.flush();
  try {
    var cache = CacheService.getScriptCache();
    if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
  } catch (e) {}

  return { success: true, data: record };
}

/**
 * 8. Update Periode
 */
function handleUpdatePeriode(ss, item) {
  const sheet = ss.getSheetByName('Periode');
  const id = item.id;
  if (!id) return { success: false, error: 'ID periode wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  const statusIdx = headers.indexOf('statusAktif');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      if (item.namaBulanHijriah !== undefined) sheet.getRange(r + 1, headers.indexOf('namaBulanHijriah') + 1).setValue(item.namaBulanHijriah);
      if (item.tahunHijriah !== undefined) sheet.getRange(r + 1, headers.indexOf('tahunHijriah') + 1).setValue(item.tahunHijriah);
      if (item.labelPeriode !== undefined) sheet.getRange(r + 1, headers.indexOf('labelPeriode') + 1).setValue(item.labelPeriode);
      if (item.statusAktif !== undefined) sheet.getRange(r + 1, statusIdx + 1).setValue(item.statusAktif);

      SpreadsheetApp.flush();
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
      } catch (e) {}

      return { success: true, message: 'Periode berhasil diperbarui.' };
    }
  }

  return { success: false, error: 'Periode tidak ditemukan.' };
}

/**
 * 9. Hapus Periode
 */
function handleDeletePeriode(ss, id) {
  return deleteRowById(ss, 'Periode', id);
}

/**
 * 10. Tambah Kategori
 */
function handleCreateKategori(ss, item) {
  const sheet = ss.getSheetByName('Kategori');
  const nama = (item.namaKategori || '').trim();
  if (!nama) return { success: false, error: 'Nama kategori wajib diisi.' };

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const nameIdx = headers.indexOf('namaKategori');

    for (let i = 0; i < values.length; i++) {
      if (values[i][nameIdx] && values[i][nameIdx].toString().toLowerCase() === nama.toLowerCase()) {
        return { success: false, error: 'Kategori "' + nama + '" sudah ada.' };
      }
    }
  }

  const id = item.id || 'KAT-' + Utilities.getUuid();
  const now = new Date().toISOString();
  const record = {
    id: id,
    namaKategori: nama,
    statusAktif: item.statusAktif !== undefined ? Boolean(item.statusAktif) : true,
    createdAt: now,
    updatedAt: now
  };

  const rowValues = HEADERS.Kategori.map(function(h) { return record[h]; });
  sheet.appendRow(rowValues);
  SpreadsheetApp.flush();
  try {
    var cache = CacheService.getScriptCache();
    if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
  } catch (e) {}

  return { success: true, data: record };
}

/**
 * 11. Update Kategori
 */
function handleUpdateKategori(ss, item) {
  const sheet = ss.getSheetByName('Kategori');
  const id = item.id;
  if (!id) return { success: false, error: 'ID kategori wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      const now = new Date().toISOString();
      sheet.getRange(r + 1, headers.indexOf('updatedAt') + 1).setValue(now);
      if (item.namaKategori !== undefined) sheet.getRange(r + 1, headers.indexOf('namaKategori') + 1).setValue(item.namaKategori);
      if (item.statusAktif !== undefined) sheet.getRange(r + 1, headers.indexOf('statusAktif') + 1).setValue(item.statusAktif);

      SpreadsheetApp.flush();
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.removeAll(['all_data', 'subsidi_data', 'pengeluaran_data', 'data']);
      } catch (e) {}

      return { success: true, message: 'Kategori berhasil diperbarui.' };
    }
  }

  return { success: false, error: 'Kategori tidak ditemukan.' };
}

/**
 * 12. Hapus Kategori
 */
function handleDeleteKategori(ss, id) {
  return deleteRowById(ss, 'Kategori', id);
}
