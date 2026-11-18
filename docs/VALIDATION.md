# Laporan validasi

Tanggal: 21 Oktober 2026. Lingkungan: Python 3.12.14, Node.js 24.19.0, browser Chromium jarak jauh.

## Otomatis

Perintah `python -m unittest discover -s tests -v` selesai dengan **18 tests passed**. Log lengkap: `docs/test-results.txt`.

Cakupan:

- Byte UTF-8 sesuai file asli dan importer tidak mengubah file sumber.
- Proposal pending tidak muncul dalam snapshot, approved muncul.
- Empat puluh proposal konkuren tersimpan tanpa kehilangan catatan.
- Truncation snapshot mempertahankan UTF-8 valid.
- Status missing/binary pada sumber memori.
- Validasi ID tim/profil dan input task.
- Dua worker overlap waktunya; reviewer dimulai setelah worker selesai.
- Approval prematur ditolak, cancellation tercatat, restart tidak otomatis mengulang pekerjaan.
- HTTP auth, Origin, static traversal, MCP initialize/list/call.
- Kontrak subprocess dengan executable stub: argv/prompt, exit nonzero, timeout.
- Mode live memerlukan flag kesiapan instalasi.
- Exit 0 tanpa receipt hasil tidak dianggap sukses; receipt valid diterima.
- Hold rekonsiliasi mencegah run baru.

Stub subprocess **bukan Hermes asli dan bukan inferensi model**. Tes ini memvalidasi adapter dan state machine, tidak membuktikan autentikasi provider atau kompatibilitas semua versi Hermes.

`node --check web/app.js` dan `node --check web/scene.js` lolos. Ekspor model OBJ berhasil. Uji geometri software dengan DOM/canvas mock menghasilkan koordinat finite; tidak ada NaN pada proyeksi mesh konfigurasi awal.

## Antarmuka browser

- Halaman memuat dan tersambung ke runtime.
- Empat ruangan, sembilan label agen dan Big Brain tampil menggunakan renderer CPU (WebGL tidak tersedia di browser ini).
- Form Buat tugas berhasil mengirim dua item simulasi.
- Papan tugas menunjukkan 3/3 tasks selesai dan status Perlu persetujuan setelah dua worker dan satu reviewer.
- Detail menampilkan keluaran simulasi berlabel jelas serta byte/SHA-256 snapshot.

Ukuran nol pada tampilan uji sesuai kondisi: tidak ada file memori pengguna pada lingkungan pengujian. Tugas QA dan token runtime tidak disertakan dalam ZIP.

## Wajib diuji di laptop tujuan

Koneksi Hermes nyata, pembacaan cache pengguna, tiga tool MCP dari dalam Hermes, profil standalone, pembatalan gateway, receipt hasil nyata, akses artefak, tool policy, jalur GPU, produksi media upstream, dan performa perangkat. Panduan HERMES_HANDOFF.md menyusun urutan pemeriksaannya. Kemiripan video belum terverifikasi.
