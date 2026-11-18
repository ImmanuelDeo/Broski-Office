# Instalasi Hermes lokal

## 1. Lingkungan

Kantor dan Hermes harus berjalan di lingkungan OS yang sama agar path file, profil dan executable konsisten. Jika Hermes berada di WSL, jalankan kantor dari WSL juga; browser Windows dapat membuka localhost sesuai konfigurasi jaringan WSL. Jangan menganggap path Windows `C:\...` sebagai path Linux.

Kantor hanya membutuhkan Python 3.10+. Gunakan `python scripts/doctor.py`. Aplikasi tidak menginstal atau mengautentikasi Hermes secara otomatis. Periksa `hermes --version`, `hermes chat --help`, dan `hermes profile --help` pada mesin tujuan.

## 2. Profil dan model

Config default menyediakan sembilan profil yang unik. Contoh membuat satu profil kosong:

```bash
hermes profile create office-nova
hermes -p office-nova setup
```

Gunakan prosedur yang sama bagi profil lain; jangan membuat ulang jika sudah ada. Clone konfigurasi hanya jika memang ingin mewarisi provider/skill; tinjau hasil clone dan jangan mewarisi channel, cron, atau gateway utama. Keberadaan nama profil unik di JSON tidak membuktikan bahwa profil tersebut telah dibuat.

Setiap agen memiliki `model` kosong. Ini sengaja memakai default yang benar-benar tersedia di profil Hermes. Untuk override, isi ID model yang valid bagi provider tersebut. Tidak ada bobot LLM dalam ZIP dan tidak ada biaya model dalam mode demo. Pemanggilan live mengikuti provider/API lokalmu dan dapat menimbulkan biaya.

Contoh invocation yang dipakai adapter:

```text
hermes --profile office-nova chat --query-file /absolute/path/prompt.txt
```

`hermes_command` adalah array, misalnya `["/absolute/path/hermes"]`. Argumen tidak melewati shell. `hermes_chat_args` menyediakan placeholder `{prompt_file}`. Bagi versi lama yang hanya menerima `-q`, buat wrapper yang membaca file dan memanggil CLI dengan argv yang aman; jangan melakukan shell interpolation terhadap prompt. Jangan berpura-pura flag tersedia jika `--help` menunjukkan sebaliknya.

## 3. Gateway dan pembatalan

Dokumentasi CLI yang diakses 21 Oktober 2026 menjelaskan bahwa CLI pada beberapa versi adalah client gateway: menutup CLI dapat meninggalkan agen berjalan. Karena itu:

- Gunakan profil `office-*` yang khusus kantor ini; jangan dipakai bot, cron atau sesi lain.
- Untuk runtime gateway, konfigurasi **standalone per profil** sesuai dokumentasi versi lokal. Contoh konfigurasi yang didokumentasikan:

```yaml
gateway:
  standalone: true
```

- `hermes_stop_args` default `["gateway", "stop"]`. Adapter menambahkan `--profile <profil-agen>`, sehingga tidak menggunakan `--all` atau profil default.
- Saat cancel, timeout, exit nonzero atau receipt tidak valid, adapter mencoba menghentikan gateway profil tersebut, kemudian menghentikan process tree CLI bila masih hidup.
- Bila stop gagal, file `.runtime/NEEDS_RECONCILIATION` menahan antrean dan pengiriman baru. Restart yang menemukan run live aktif juga memasang hold. Periksa profil dan pekerjaan yang belum selesai; setelah benar-benar berhenti, gunakan `python scripts/reconcile.py --confirmed-stopped`.
- Keberhasilan command stop tetap harus diuji pada versi lokal. Gateway multiplexer memiliki semantik berbeda; memarkir profil bukan bukti semua pekerjaan sudah dihentikan. Jangan mengaktifkan mode live sebelum uji pembatalan pada profil standalone.
- Untuk versi Hermes yang benar-benar in-process, `hermes_stop_args` bisa `[]` setelah kontraknya diverifikasi. Process-tree termination berlaku pada proses turunannya, bukan proses daemon independen.

## 4. Pasang Big Brain MCP

Tambahkan stanza berikut ke **config.yaml setiap profil**, sambil mempertahankan pengaturan yang ada. Ganti seluruh path dengan path absolut milik mesin ini. Python MCP boleh memakai interpreter Python kantor karena hanya memakai standard library.

```yaml
mcp_servers:
  nexus_office:
    command: "/absolute/path/to/python3"
    args: ["/absolute/path/nexus-office/mcp_server.py"]
    env:
      NEXUS_URL: "http://127.0.0.1:8765"
      NEXUS_DATA_DIR: "/absolute/path/nexus-office/.runtime"
```

Windows memakai path interpreter python.exe dan slash `/` atau escaping YAML yang benar. Jika port/data-dir diganti, ganti kedua sisi. Token dibuat oleh kantor dan dibaca MCP dari `.runtime/token`; tidak perlu ditempel dalam YAML atau browser URL.

Tool yang tersedia:

| Tool | Fungsi |
|---|---|
| `office_brain(query?)` | Membaca sumber yang tersedia dan catatan approved; pencarian substring |
| `office_propose_memory(title, content)` | Usulan pengetahuan yang menunggu pengguna |
| `office_progress(task_id?, progress, message)` | Milestone aktual untuk task aktif; task_id wajib dikirim pada runtime gateway |

Restart/reload koneksi MCP sesuai versi Hermes. Tugas selalu menerima snapshot memori di prompt, sehingga konteks awal tetap tersedia walau MCP tidak tersambung. Pembacaan terbaru dan progress granular memerlukan MCP. Aplikasi tidak menyadap chain-of-thought atau mengarang persentase proses live.

## 5. Sambungkan cached memory

Ubah `memory_sources` di `config/office.json`:

```json
[
  {"id":"hermes-memory","path":"/absolute/path/to/MEMORY.md"},
  {"id":"brand-rules","path":"/absolute/path/ai-creative-team/brain/memory.jsonl"}
]
```

File UTF-8 teks/Markdown/JSON/JSONL sampai 16 MiB per file dapat dibaca. JSONL dipertahankan sebagai teks, tidak dikonversi menjadi graph semantik. Sumber dibaca tiap 5 detik; tidak ditulis kembali. File yang hilang/berformat biner/terlalu besar ditandai jelas. Ukuran byte file yang tersedia tetap dihitung meskipun sumber terlalu besar untuk dimasukkan sebagai teks. Hilangnya file menghapus isinya dari snapshot berikutnya.

Cache milik provider eksternal, database percakapan, vector index, atau KV cache model **bukan otomatis MEMORY.md**. Siapkan ekspor UTF-8 berisi pengetahuan yang memang ingin dibagikan, atau adapter provider khusus. Jangan menyalin kredensial ke Big Brain. Isi memori yang dimasukkan ke prompt mengikuti aliran data provider model yang kamu pilih; server kantor sendiri tidak mengunggah memori ke layanan lain.

## 6. Media tools dari ai-creative-team

```bash
python scripts/fetch_upstream.py
```

Script melakukan clone ke external/ai-creative-team dan mencatat commit aktual; tidak mengeksekusi setup upstream. Baca README, lisensi, prompt peran, dan setup.sh. Ikuti setup upstream untuk ffmpeg, speech-to-text, font, dan Python dependencies. Pada Windows, tools upstream mungkin lebih mudah dijalankan dari WSL; periksa versi yang diunduh.

Berikan path checkout dan path absolut clip melalui brief atau approved memory. Worker memakai tools asli setelah membaca help/source, kemudian menulis hasil ke folder task. Input tidak dipindahkan otomatis ke done; desain ini menjaga file asli tetap tersedia untuk retry. Aplikasi tidak mengimplementasikan ulang ffmpeg/STT di backend.

## 7. Aktifkan dan uji live

Sesudah konfigurasi di atas siap, ubah:

```json
{"mode":"live","live_ready":true,"max_parallel":2,"require_result_file":true}
```

Restart kantor. Jalankan satu tugas kecil terlebih dahulu. Adapter menuntut **result.json** di folder task:

```json
{"status":"completed","summary":"Ringkasan hasil dan pemeriksaan yang benar-benar dilakukan","artifacts":["notes.md"]}
```

Prompt meminta agen membuat receipt setelah selesai. Jika pekerjaan terblokir, gunakan `status: "blocked"`; kantor menandai task gagal untuk ditinjau, bukan menganggap sukses. Exit code 0 dan teks log saja tidak cukup. Daftar artifacts adalah deklarasi model, bukan validasi isi; reviewer dan manusia harus memeriksa file nyata. Aplikasi menampilkan receipt di panel hasil dan menyimpan console.log untuk diagnosis.

Jika live gagal, tampilkan error, periksa log di `.runtime/runs/<run>/<task>/console.log`, dan kembali ke demo sampai masalah teratasi. Jangan matikan `require_result_file` hanya untuk menyembunyikan kegagalan.

## 8. Permission boundary

UI approval mengatur penerimaan hasil dan usulan Big Brain. Ia **tidak** mencegah tool Hermes melakukan tindakan di luar scope jika profil memiliki izin tersebut. Terapkan izin tool, sandbox atau direktori kerja sesuai fasilitas Hermes versi lokal. Instruksi prompt tidak menggantikan kontrol akses. Default tidak memberi flag yolo, tidak mengubah izin, dan server bind ke loopback.
