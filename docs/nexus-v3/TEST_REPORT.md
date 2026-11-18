# Laporan pengujian paket

Tanggal: 22 Oktober 2026. Lingkungan pembuat paket: Linux, Python 3.12.14, Node 24.19.0, Chromium headless 156.0.8078.47 melalui Playwright, WebGL SwiftShader. Bukan laptop Windows/Hermes pengguna.

## Hasil aktual

| Pengujian | Hasil |
|---|---|
| Python `python -m unittest discover -s tests -v` | **15/15 PASS** |
| JavaScript `node --test tests/*.test.js` | **7/7 PASS** |
| Browser `tests/browser.mjs` | **PASS**, tidak ada pageerror |
| Office ↔ Kanban | **20 siklus PASS**, hanya satu canvas, RAF berhenti saat panel hidden |
| Kamera setelah kembali | Posisi/target dipertahankan dalam toleransi floating point 1e-8, zoom sama |
| Resize viewport | Ukuran renderer sesuai container, proyeksi finite |
| Agen yang sudah di kursi menerima task | Beralih ke typing, tidak tersangkut walk |
| Dedupe knowledge event | ID yang sama tidak membuat pulse tambahan |
| Reduced motion dan dispose | Jam animasi berhenti; canvas dibuang saat dispose |
| Label ruang | Tinggi <40px, tidak mewarisi min-height kartu dashboard |

Snapshot renderer pada browser smoke test: **8 agen, 243 draw calls, 27.572 triangles, 4 geometri, 0 texture**, viewport 1178×620 CSS px. Angka draw calls dapat berubah menurut visibilitas cup/partikel. Ini bukan benchmark FPS native GPU. Render cap 30 FPS dan DPR ≤1.25 adalah konfigurasi, bukan jaminan performa laptop.

## Risiko yang diuji

Tes model memeriksa distribusi 2/4/1/1, ID unik, layout seed stabil, seluruh kursi dapat mencapai seluruh anchor, semua segmen jalur bebas collider, tujuan tertutup gagal, dan simulasi 20 menit tanpa menembus collider. Pada pertengahan simulasi seluruh agen diberi task; semua berakhir mengetik di kursi masing-masing.

Tes Python mencakup process liveness/ownership tidak pasti, error permanen, missing checkpoint, retry budget dan restart, repeated polling, crash setelah commit, Retry-After, pembatalan/approval, jadwal Asia/Jakarta, dedupe RSS, link Atom, penolakan XML entities, evidence refresh failure, last-good cache, coordinator daily queue, dan staging/rollback yang menjaga file asli maupun file addon yang sudah diedit lokal.

Temuan yang diperbaiki selama pengujian: deadlock saat agen saling menghalangi, walk tidak selesai jika titik awal sama dengan tujuan, SQL placeholder yang salah, pewarisan CSS kartu ke label ruang, dan cache verifikasi yang kehilangan tanggal last-good saat refresh gagal.

## Belum diuji di sini

- Source asli Nexus, test suite lama 18/18, payload `/api/state` asli, dan API/migrasi `office.db` asli.
- Task Hermes live, profil/provider/gateway pengguna, MCP dan memory_sources pribadi.
- Adapter resume_once/enqueue_daily_once asli, schema receipt/handoff, reviewer/approval/cancel pada backend lama.
- Jadwal pada mesin yang benar-benar sleep/offline, jaringan pengguna, feed availability aktual, dan refresh situs sepanjang waktu.
- Windows display scaling/DPI, native GPU FPS, multi-hour memory soak, WebGL context restoration/fallback pada perangkat pengguna.

Karena source asli tidak tersedia, hasil pengujian di atas tidak membuktikan kompatibilitas penuh atau bebas regresi terhadap kantor existing. Checklist verifikasi lokal lengkap ada di HERMES_SETUP.md.

## Menjalankan tes browser opsional

Pasang Playwright hanya pada lingkungan pengujian, bukan dependency produksi. Jalankan `node tests/browser.mjs`. Bila paket/executable tidak berada pada default resolution, gunakan environment variables `NEXUS_PLAYWRIGHT_MODULE`, `NEXUS_CHROMIUM_PATH`, dan opsional `NEXUS_PYTHON`. `NEXUS_SCREENSHOT` hanya untuk capture debugging lokal. Script menjalankan preview pada port 8874 dan menghentikan proses preview miliknya sendiri pada akhir tes.
