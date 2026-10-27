const https = require('https');
const { parsePublishedCsv } = require('../lib/csv-importer');

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQNWBm5T4mWn0dvFjFZRJ-uQlTNzUzMUgvZlRfzbTiR1_qPcDXO_s4g0lJ3mcTpl4g9rj_BZhR1jbpe/pub?output=csv';

function get(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching live CSV from:', url);
  const csv = await get(url);
  console.log('Raw CSV Length:', csv.length);
  const parsed = parsePublishedCsv(csv);
  console.log('\n--- PARSED GOOGLE SHEETS LIVE DATA ---');
  console.log('Kategori:', parsed.kategoriNama, `(${parsed.kategoriId})`);
  console.log('Periode:', parsed.labelPeriode, `(${parsed.periodeId})`);
  console.log('Subsidi:', parsed.subsidiNominal, `(Item Count: ${parsed.subsidi.length})`);
  console.log('Pengeluaran Count:', parsed.pengeluaran.length);
  parsed.pengeluaran.forEach((p, idx) => {
    console.log(`  [Item ${idx + 1}]:`, p.namaBarang, '|', p.jumlah, p.satuan, '| @ Rp', p.hargaSatuan, '| Total Rp', p.total);
  });
  const totalExp = parsed.pengeluaran.reduce((sum, p) => sum + p.total, 0);
  const saldo = parsed.subsidiNominal - totalExp;
  console.log('Total Pengeluaran:', totalExp);
  console.log('Saldo Tersisa:', saldo);
}

main().catch(console.error);
