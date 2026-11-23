# Panduan integrasi lokal — mulai dari sini

## Status paket

Paket ini dibuat dari overview v2 dan screenshot, bukan salinan source asli. Frontend 3D dan modul Python baru tersedia sebagai kode runnable. Preview terpisah tidak menjalankan Hermes. Hermes lokal harus menghubungkan kontrak ke implementasi `core.py`/`app.js` yang sesungguhnya, menjalankan tes lama, lalu mengaktifkan pembaruan. Tidak ada klaim bahwa seluruh fitur lama sudah diuji dari lingkungan pembuat paket.

Lokasi proyek menurut dokumen: `D:/nexus-office`. Provider yang tercatat: profil `office-*`, model `hermes-combo`, endpoint lokal `http://127.0.0.1:20128/v1`. Gunakan konfigurasi yang benar-benar aktif; jangan hardcode ulang atau menimpa credential.

## 1. Baseline dan backup

1. Baca AGENTS.md/instruksi proyek lokal, `server.py`, `core.py`, `mcp_server.py`, `config/office.json`, `web/app.js`, dan modul `web/nexus-v2/`. Petakan lifecycle renderer, handler tab, shape `/api/state`, format run/result/receipt, scheduler locking, registry profil, dan schema SQLite.
2. Catat status service dan PID server kantor. Jangan matikan gateway induk atau seluruh proses Python. Bila ada run aktif, tunggu safe checkpoint/selesai sebelum migrasi roster; jangan mengubah assignment di tengah run.
3. Jalankan baseline:

   ```powershell
   Set-Location D:\nexus-office
   python -m unittest discover -s tests -v
   python scripts/doctor.py
   ```

4. Dari folder paket yang sudah diekstrak:

   ```powershell
   python scripts/backup_office.py --target D:/nexus-office
   python scripts/install_addon.py --target D:/nexus-office
   python scripts/install_addon.py --target D:/nexus-office --apply
   ```

   Backup memakai SQLite backup API, bukan menyalin `office.db` tanpa WAL. Installer hanya menambahkan namespace baru, menolak overwrite file berbeda, dan tidak mengaktifkan fitur otomatis. Simpan path backup. Tidak ada npm/webpack/build step.

Screenshot baseline memuat pesan `Handoff Hermes belum valid` dan status koneksi terputus. Periksa apakah ini masih terjadi. Jangan menyamarkannya sebagai masalah animasi atau mengubah receipt validator menjadi selalu sukses. `live_ready: true` tidak membuktikan semua run sehat.

## 2. Roster: tepat delapan agen aktif

Gunakan `config/nexus-v3/roster.json` sebagai spesifikasi, bukan pengganti seluruh `office.json`. Buat migrasi sesuai schema asli dan pertahankan field provider, token, port, memory_sources, auth dan approval.

| ID lama yang dipertahankan | Nama | Tim aktif | Peran baru | Profil |
|---|---|---|---|---|
| analyst | Izuku Midoriya | reports | Peneliti/penulis laporan | office-atlas |
| research-review | Choso | reports | Metodologi/editor/reviewer akademik | office-lyra |
| builder | Levi Ackerman | engineering | Software engineer | office-axel |
| code-review | EMIYA | engineering | QA/technical reviewer | office-echo |
| editor-1 | Eren Yeager | engineering | ML/data engineer | office-nova |
| editor-2 | Shinei Nouzen | engineering | Systems/integration engineer | office-pixel |
| planner | Artoria Pendragon | supervision | Supervisor lintas tim | office-orion |
| ops-review | Cú Chulainn | intelligence | Pencarian/scraping harian | office-mira |

`brand`/Sage menjadi nonaktif/arsip; jangan hapus profil, run, task, notes, atau sejarahnya. Team IDs creative/research/operations lama boleh tetap ada dalam arsip tetapi tidak muncul sebagai tim aktif. Task historis menyimpan team/role/agent snapshot saat run dibuat. Migrate tampilan inspector, counters, form submit, routing dan validasi backend bersama; mengganti label frontend saja tidak memenuhi permintaan.

Prompt baru berada di `prompts/nexus-v3/<agent-id>.md`. Sesuaikan metadata prompt dengan loader asli. Cek `hermes --help` dan command yang sudah dipakai proyek sebelum mengubah pengaturan profil; paket ini tidak mengasumsikan subcommand pembuatan profil. Semua profil tetap isolated dan tidak mewarisi cron/channel global.

Routing reviewer: laporan → Choso; IT → EMIYA; hasil Cú Chulainn → Artoria Pendragon. Artoria Pendragon mengawasi seluruh tim dan menangani recovery; bukan agen tambahan. Jika stage scheduler hanya worker/reviewer, perluas registry dengan supervisor atau map ke fungsi supervisor eksplisit. Jangan otomatis memasukkan supervisor ke round-robin worker. Reviewer tidak mereview hasilnya sendiri; jika EMIYA/Choso mendapat task produksi, Artoria Pendragon menjadi reviewer untuk task itu. Pertahankan human approval final dan review memory notes.

## 3. Pasang view v3 tanpa renderer ganda

1. Tambahkan stylesheet `nexus-v3/styles.css` pada shell, dengan URL sesuai static router yang sudah ada.
2. Buat container v3 sendiri dengan ukuran CSS yang pasti. Jangan hapus seluruh `#office-viewport` bila berisi fallback lama. Contoh: child khusus `<div id="living-office-host"></div>` berukuran 100% × tinggi viewport.
3. Gunakan named import dari `./nexus-v3/bridge.js` di `web/app.js`. Buat `projectStateV3` berdasarkan response nyata `/api/state`; ikuti `STATE_CONTRACT.md`. Validasi terhadap fixture snapshot lokal (redact credential).

   ```js
   import {mountLivingOffice} from './nexus-v3/bridge.js';
   const officeV3 = mountLivingOffice({
     container: document.getElementById('living-office-host'),
     projectState: projectStateV3,
     onSelect: openExistingInspector,
     quality: 'balanced'
   });
   // Setelah konstruktor berhasil: pause/dispose v2 dan fallback lama.
   // Di polling sukses yang SUDAH ADA:
   officeV3.update(rawState);
   // Di polling gagal:
   officeV3.disconnect();
   // Pada routing tab yang SUDAH ADA:
   officeV3.setActive(activeTab === 'office');
   // Pada unmount aplikasi: officeV3.dispose();
   ```

   `projectStateV3`, `openExistingInspector`, `rawState` dan `activeTab` di atas adalah titik sambung yang harus diisi dari aplikasi asli, bukan nama fungsi yang dijamin sudah ada.

4. Jangan membuat polling `/api/state` kedua. Jangan fetch session token dari modul animasi. Tetap gunakan request/auth/session/CSP lama. Vendor disertakan lokal dan pinned Three.js r170; tidak membutuhkan import map atau CDN saat runtime.
5. Semua tombol existing Overview, Top view, Motion diteruskan ke API v3. Perubahan pilihan tim/agen diteruskan ke inspector existing. Hindari mengaktifkan dua versi kontrol di kanvas yang sama.
6. Mount v3 hanya sekali. Saat beralih ke Kanban sembunyikan host dan panggil `setActive(false)`. Saat kembali tampilkan host dan `setActive(true)`. ResizeObserver akan mengukur ukuran valid; pertahankan orbit/target/zoom. Jangan panggil home pada setiap tab switch.
7. Jika inisialisasi WebGL gagal, hapus child v3 yang belum berhasil dan aktifkan fallback lama yang masih tersedia. Uji error recovery ini. Jangan menampilkan panel kosong dengan label LIVE palsu.

## 4. Hubungkan supervisor ke scheduler asli

1. Impor `nexus_addon.supervisor.Supervisor`; buat satu instance per scheduler owner, DB `.runtime/nexus-v3-addon.db`.
2. Implementasikan dua callback adapter pada `STATE_CONTRACT.md`. Gunakan transaksi database scheduler asli untuk idempotency key + attempt creation. Tambahkan unique index pada key melalui migrasi baru yang memiliki rollback, jangan membuang schema/data lama.
3. Di tick/event failure, buat task snapshot yang telah diverifikasi, panggil observe. Dispatch request due lewat scheduler lama. Liveness wajib diperiksa kembali pada dispatch, bukan hanya ketika observe.
4. Keputusan inspect/escalate menghasilkan event dan task supervisi deduped kepada Artoria Pendragon. Retry tidak boleh berjalan saat cancel, approval pending, process owner tidak jelas, atau checkpoint belum valid.
5. Checkpoint harus menunjuk data yang benar-benar tersimpan: tujuan asli, subtask selesai, output path/hash, langkah tersisa, side-effect ledger. Gunakan continuation prompt dan task ID sama dengan attempt baru. Jangan sekadar mengirim kata “lanjutkan”.
6. Pada restart, rekonsiliasi entry dispatching/uncertain dengan receipt durable. Jika status belum jelas, tahan dan laporkan. Jangan reset counter untuk menghindari batas retry.
7. Heartbeat threshold awal 180 detik hanya untuk inspeksi. Sesuaikan dengan operasi panjang yang sah; training ML tidak otomatis dianggap macet karena belum menulis output.

## 5. Hidupkan pencarian dan fun fact

Gunakan coordinator yang sudah disediakan: `AddonRuntime(project_root, adapter).start()` setelah ownership scheduler lama terverifikasi, dan `stop()` pada shutdown. Implementasikan semua callback di bagian coordinator `STATE_CONTRACT.md`; ini menjadi satu tempat untuk recovery, jadwal dan refresh, bukan tiga timer browser terpisah. Jangan menjalankan coordinator ini sekaligus dengan tick manual kedua.

- Buat satu tick background pada backend/scheduler untuk `DailySchedules`, bukan timer browser. Browser boleh ditutup tanpa menghentikan jadwal jika server tetap berjalan.
- Topik harian belum diberikan pengguna. Biarkan job pencarian `enabled:false` sampai topik disetel melalui konfigurasi/form existing. Sesudah topik disetel, simpan timezone/jam dan gunakan `stage` + `dispatch(enqueue_once)`; request diarahkan ke Cú Chulainn.
- Cú Chulainn memakai `collect_research.py` untuk seed RSS/Atom dan tools pencarian Hermes untuk cakupan tambahan. Feed hanyalah daftar awal, ketersediaannya harus diperiksa lokal. Hasil collector menyimpan URL, tanggal, status lead, dan error per sumber.
- `facts_refresh` adalah pengaturan untuk tick yang perlu dihubungkan: jalankan `refresh_facts.py` sekali sehari pada 07:30 Asia/Jakarta melalui job background deduped tanggal, maksimal dua HTTP request. Tidak memerlukan invocation LLM berulang untuk seed facts. Bila laptop mati, jalankan refresh hari ini setelah startup.
- Simpan cache di `.runtime`, expose hanya subset fakta publik melalui endpoint authenticated/same-origin yang mengikuti validasi Host/Origin lama. Jangan expose seluruh folder `.runtime` melalui static router.
- Pertahankan cache jika pengambilan gagal. Panggil `setFacts` hanya dengan record yang lolos review/TTL. Untuk kandidat baru dari Cú Chulainn gunakan review Artoria Pendragon sebelum mengubah cache. Jangan menyebut headline mentah sebagai fakta valid.

## 6. Verifikasi sebelum mengaktifkan

Jalankan tes paket (Node hanya alat tes opsional, bukan dependency runtime):

```powershell
python -m unittest discover -s tests -v
node --test tests/*.test.js
python scripts/preview.py
# Buka http://127.0.0.1:8873/preview/
```

Jalankan dari folder paket agar tidak mencampur tests lama dan baru. Setelah integrasi, ulangi tests lama di root proyek dan tambah integration tests untuk adapter asli. Daftar acceptance wajib:

- Tepat 8 agen aktif dan distribusi 2/4/1/1 di API, counter, inspector, form task, routing dan visual. Histori 9 agen lama masih dapat dibuka.
- Task nyata laporan, IT, pencarian, dan supervisi berjalan dengan profil yang benar; hasil review/approve/cancel tetap berfungsi. Big Brain read/search dan propose/approve notes tetap berfungsi; MEMORY.md/USER.md tak berubah.
- Induksi RTO/truncated terkontrol, checkpoint continuation, cancel saat menunggu backoff, timeout sesudah commit, dan restart. Tidak ada dua subprocess untuk task/attempt yang sama; maksimum tiga retry.
- Kamera digeser/zoom, pindah Office↔Kanban 20 kali, resize panel/window, minimise/browser hide/show. Orbit/target/zoom tetap; hanya satu canvas aktif dan satu RAF. Uji WebGL context loss + restore serta fallback.
- Semua agent menerima task saat sedang lounge/chat/arcade lalu kembali ke kursi. Cek tangan di keyboard, lutut, pintu, dan benturan. Partikel hanya pada event knowledge nyata.
- Tidak ada network request per frame. Ukur FPS, draw calls, GPU/memory dan CPU di laptop user pada balanced/low; tidak menjanjikan FPS hanya dari tes headless.
- Simulasikan hari berikutnya, outage feed, duplicate RSS, dan restart setelah enqueue. Satu daily run per ID/tanggal; fact cache gagal refresh tidak mendapat tanggal verifikasi palsu.

Jika seluruh kriteria lulus, aktifkan v3 sebagai default dan simpan flag rollback ke v2. Berikan laporan file berubah, migrasi, tes, profil/role mapping, jadwal aktif, dan sisa blocker. Jangan mengatakan “sudah terintegrasi” sebelum task live dan acceptance diuji.

## 7. Rollback

Sebelum rollback, hentikan hanya server kantor pada PID terverifikasi dan pastikan tidak ada run aktif. Restore entry point `app.js`, HTML/CSS, config dan patch backend dari backup integrasi, atau revert commit khusus update. Jangan restore `office.db` lama jika sudah ada run baru tanpa rekonsiliasi; itu akan membuang data baru.

`rollback_stage.py --target D:/nexus-office --apply` hanya menghapus file addon yang masih identik dengan hash staging. File yang diedit ditahan. Script tidak otomatis membalik integrasi app.js/core.py/config; langkah itu harus dari backup/commit Hermes. `.runtime/nexus-v3-addon.db` dipertahankan untuk audit. Bila reconciliation hold muncul, ikuti prosedur lokal; jangan menandai stopped sebelum proses terbukti berhenti.
