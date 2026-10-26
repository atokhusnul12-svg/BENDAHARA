/**
 * =========================================================================
 * BENDAHARA MMD - GOOGLE APPS SCRIPT BACKEND
 * Majelis Musyawarah & Dirosah
 * =========================================================================
 * Skrip ini dipasang di Google Sheets (Ekstensi -> Apps Script)
 * Berfungsi sebagai API penghubung aman antara Web App dan Google Sheets.
 */

// Konfigurasi Header Kolom
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
 * Validasi Token Keamanan
 */
function validateAuth(token) {
  const scriptProps = PropertiesService.getScriptProperties();
  const configuredToken = scriptProps.getProperty('MMD_API_TOKEN') || 'mmd-amanah-kas-secret';
  if (!token || token !== configuredToken) {
    return false;
  }
  return true;
}

/**
 * Endpoint GET - Health Check & Pemeriksaan Koneksi
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return jsonResponse({
      success: true,
      status: 'online',
      appName: 'Bendahara MMD API',
      spreadsheetName: ss ? ss.getName() : 'Unknown',
      spreadsheetId: ss ? ss.getId() : 'Unknown',
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
 * Endpoint POST - Penanganan Seluruh Perintah CRUD
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Kunci untuk mencegah race condition / penulisan bersamaan
    lock.waitLock(30000);

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Format JSON permintaan tidak valid.' });
    }

    // Validasi token rahasia
    if (!validateAuth(payload.token)) {
      return jsonResponse({ success: false, error: 'Akses ditolak: Token autentikasi salah atau tidak ada.' });
    }

    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({ success: false, error: 'Tidak dapat menemukan Spreadsheet aktif.' });
    }

    // Pastikan seluruh sheet dan header tersedia
    ensureSheetsInitialized(ss);

    let result;
    switch (action) {
      case 'ping':
        result = handlePing(ss);
        break;
      case 'init':
        result = { success: true, message: 'Inisialisasi tabel Google Sheets berhasil.' };
        break;
      case 'getData':
        result = handleGetData(ss, payload.filters);
        break;
      case 'createPengeluaran':
        result = handleCreatePengeluaran(ss, payload.data);
        break;
      case 'updatePengeluaran':
        result = handleUpdatePengeluaran(ss, payload.data);
        break;
      case 'deletePengeluaran':
        result = handleDeletePengeluaran(ss, payload.id);
        break;
      case 'createSubsidi':
        result = handleCreateSubsidi(ss, payload.data);
        break;
      case 'updateSubsidi':
        result = handleUpdateSubsidi(ss, payload.data);
        break;
      case 'deleteSubsidi':
        result = handleDeleteSubsidi(ss, payload.id);
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
 * Format Response JSON
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Memastikan sheet dan header kolom ada tanpa menghapus data yang sudah ada
 */
function ensureSheetsInitialized(ss) {
  for (let sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADERS[sheetName]);
      // Format header tebal dan latar abu-abu lembut
      const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#005c55');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      // Periksa apakah baris header sudah ada
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(HEADERS[sheetName]);
        const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#005c55');
        headerRange.setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
    }

    // Inisialisasi kategori bawaan jika sheet Kategori belum ada baris data
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

    // Inisialisasi periode bawaan jika sheet Periode belum ada baris data
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
 * Status Ping
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
    // Abaikan baris kosong
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
 * Mengambil seluruh data
 */
function handleGetData(ss) {
  return {
    success: true,
    pengeluaran: getSheetObjects(ss, 'Pengeluaran'),
    subsidi: getSheetObjects(ss, 'Subsidi'),
    periode: getSheetObjects(ss, 'Periode'),
    kategori: getSheetObjects(ss, 'Kategori')
  };
}

/**
 * 1. Simpan Pengeluaran Baru (Mendukung Multi-item dalam 1 event)
 */
function handleCreatePengeluaran(ss, data) {
  const sheet = ss.getSheetByName('Pengeluaran');
  const now = new Date().toISOString();
  const items = Array.isArray(data) ? data : [data];
  const inserted = [];

  const headers = HEADERS.Pengeluaran;

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
    sheet.appendRow(rowValues);
    inserted.push(record);
  });

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
      return { success: true, id: id, updated: updated };
    }
  }

  return { success: false, error: 'Transaksi dengan ID ' + id + ' tidak ditemukan.' };
}

/**
 * 3. Hapus Pengeluaran
 */
function handleDeletePengeluaran(ss, id) {
  const sheet = ss.getSheetByName('Pengeluaran');
  if (!id) return { success: false, error: 'ID transaksi pengeluaran wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const idColIndex = values[0].indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      sheet.deleteRow(r + 1);
      return { success: true, message: 'Pengeluaran berhasil dihapus.', id: id };
    }
  }

  return { success: false, error: 'Transaksi dengan ID ' + id + ' tidak ditemukan.' };
}

/**
 * 4. Tambah Subsidi
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

  const rowValues = HEADERS.Subsidi.map(function(h) { return record[h]; });
  sheet.appendRow(rowValues);

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
      return { success: true, id: id, updated: updated };
    }
  }

  return { success: false, error: 'Catatan subsidi tidak ditemukan.' };
}

/**
 * 6. Hapus Subsidi
 */
function handleDeleteSubsidi(ss, id) {
  const sheet = ss.getSheetByName('Subsidi');
  if (!id) return { success: false, error: 'ID subsidi wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

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
      return { success: true, message: 'Subsidi berhasil dihapus.', id: id };
    }
  }

  return { success: false, error: 'Catatan subsidi tidak ditemukan.' };
}

/**
 * 7. Tambah Periode (dengan pencegahan duplikat)
 */
function handleCreatePeriode(ss, item) {
  const sheet = ss.getSheetByName('Periode');
  const namaBulan = (item.namaBulanHijriah || '').trim();
  const tahun = (item.tahunHijriah || '').toString().trim();
  const label = namaBulan + ' ' + tahun + ' H';

  // Cek duplikasi
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

  // Jika periode baru aktif, nonaktifkan periode lain jika diinginkan
  if (statusAktif && lastRow > 1) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusIdx = headers.indexOf('statusAktif');
    if (statusIdx !== -1) {
      for (let r = 2; r <= lastRow; r++) {
        sheet.getRange(r, statusIdx + 1).setValue(false);
      }
    }
  }

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

  return { success: true, data: record };
}

/**
 * 8. Update Periode / Jadikan Aktif
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

  // Jika hendak mengaktifkan, nonaktifkan semua dulu
  if (item.statusAktif) {
    for (let r = 1; r < values.length; r++) {
      sheet.getRange(r + 1, statusIdx + 1).setValue(false);
    }
  }

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      if (item.namaBulanHijriah !== undefined) sheet.getRange(r + 1, headers.indexOf('namaBulanHijriah') + 1).setValue(item.namaBulanHijriah);
      if (item.tahunHijriah !== undefined) sheet.getRange(r + 1, headers.indexOf('tahunHijriah') + 1).setValue(item.tahunHijriah);
      if (item.labelPeriode !== undefined) sheet.getRange(r + 1, headers.indexOf('labelPeriode') + 1).setValue(item.labelPeriode);
      if (item.statusAktif !== undefined) sheet.getRange(r + 1, statusIdx + 1).setValue(item.statusAktif);

      return { success: true, message: 'Periode berhasil diperbarui.' };
    }
  }

  return { success: false, error: 'Periode tidak ditemukan.' };
}

/**
 * 9. Tambah Kategori
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

  return { success: true, data: record };
}

/**
 * 10. Update Kategori
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

      return { success: true, message: 'Kategori berhasil diperbarui.' };
    }
  }

  return { success: false, error: 'Kategori tidak ditemukan.' };
}

/**
 * 11. Hapus Periode
 */
function handleDeletePeriode(ss, id) {
  const sheet = ss.getSheetByName('Periode');
  if (!id) return { success: false, error: 'ID periode wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      sheet.deleteRow(r + 1);
      return { success: true, message: 'Periode berhasil dihapus.' };
    }
  }

  return { success: false, error: 'Periode tidak ditemukan.' };
}

/**
 * 12. Hapus Kategori
 */
function handleDeleteKategori(ss, id) {
  const sheet = ss.getSheetByName('Kategori');
  if (!id) return { success: false, error: 'ID kategori wajib ada.' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Data kosong.' };

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idColIndex] === id) {
      sheet.deleteRow(r + 1);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }
  }

  return { success: false, error: 'Kategori tidak ditemukan.' };
}

