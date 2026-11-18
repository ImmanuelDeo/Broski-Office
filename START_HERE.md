# Nexus · Hermes Virtual Office

Paket aplikasi lokal untuk mengelola tim agen melalui kantor 3D, Big Brain, papan tugas, dan persetujuan pengguna. Dibuat 21 Oktober 2026.

## Mulai dalam satu perintah

Persyaratan aplikasi kantor: **Python 3.10+** dan browser modern. Tidak perlu npm, pip, API key, atau koneksi internet untuk menjalankan mode demo. Node.js hanya diperlukan jika ingin mengekspor ulang model OBJ.

Dari folder hasil ekstraksi:

```bash
python server.py
```

Di Windows jika `python` tidak tersedia, gunakan `py -3 server.py`. Di Linux/macOS dapat memakai `python3 server.py` atau `bash start.sh`. PowerShell: `./start.ps1` jika kebijakan lokal mengizinkan script; tidak perlu mengubah execution policy karena perintah Python langsung juga tersedia.

Buka **http://127.0.0.1:8765**. Jangan membuka `web/index.html` secara langsung.

1. Klik **Buat tugas**, pilih Creative Studio, isi brief dan dua item.
2. Worker berjalan paralel, kemudian reviewer memeriksa hasil.
3. Buka tab Tugas → Detail → Baca keluaran & snapshot.
4. Setujui atau tolak hasil setelah meninjaunya.
5. Buka Big Brain untuk memeriksa sumber dan mengajukan pengetahuan bersama.

Label **DEMO** berarti simulasi, bukan hasil LLM. Tidak ada media nyata yang dibuat dalam mode ini. Byte memori berasal dari file sumber yang benar-benar ditemukan; angka 0 jika belum ada sumber bukan error tampilan.

## Serahkan kepada Hermes lokal

Buka **HERMES_HANDOFF.md** dan berikan isinya kepada Hermes lokal. File itu berisi instruksi instalasi dari awal sampai uji penerimaan. Kode proyek sudah tersedia; Hermes lokal perlu menyesuaikan path, versi CLI, profil, autentikasi provider, izin tool, dan lokasi cache milikmu.

Panduan rinci:

- `docs/HERMES_SETUP.md`: koneksi Hermes, mode live, model dan gateway.
- `docs/ARCHITECTURE.md`: alur data, memori, status dan batas keamanan.
- `docs/EXTENDING.md`: tambah tim, karakter, ruangan dan prompt.
- `docs/API.md`: API lokal dan MCP.
- `docs/REFERENCE_AND_LIMITS.md`: kesesuaian referensi dan batas yang belum diverifikasi.
- `docs/VALIDATION.md`: hasil pengujian dan pemeriksaan lokal yang masih diperlukan.

## Isi paket

| Lokasi | Fungsi |
|---|---|
| `server.py`, `core.py` | HTTP lokal, SQLite, antrean, worker paralel, reviewer, receipt hasil |
| `mcp_server.py` | Server MCP stdio untuk membaca Big Brain, mengajukan memori dan melaporkan progres |
| `web/` | UI, renderer 3D WebGL, renderer CPU cadangan, navigasi dan panel |
| `config/office.json` | Tim, profil, warna, karakter, model, sumber memori, batas eksekusi |
| `prompts/` | Peran worker dan reviewer untuk tiap tim |
| `models/*.obj` | Model otak, karakter, dan ruangan yang dapat dibuka di Blender |
| `scripts/` | Diagnostik, tambah tim, ambil repositori referensi, ekspor model, pemulihan |
| `tests/` | Pengujian backend, integrasi HTTP/MCP dan kontrak proses |

Setelah berjalan, `.runtime/` menyimpan database, token lokal, prompt, receipt, log, dan output. Folder ini tidak dimasukkan ke paket distribusi. Simpan cadangan secara privat saat server berhenti.

## Penting mengenai referensi

Alur Creative Studio mengadaptasi pola yang dijelaskan README `bekhruztbx/ai-creative-team`. Repositori tersebut ditujukan untuk Claude Code; paket ini membuat orkestrasi Hermes yang terpisah. Tools media upstream diunduh ketika instalasi lokal, sehingga lisensi dan revisinya tetap bisa diperiksa.

Video YouTube yang diberikan tidak dapat dibuka di lingkungan pembuatan. Karena itu, **kemiripan visual 90% dan kesamaan teks video belum dapat dinyatakan**. Desain ini mewujudkan deskripsi kantor 3D dengan otak pusat dan ruangan di sekelilingnya. Tangkapan layar referensi diperlukan untuk penyesuaian visual yang dapat dibandingkan secara langsung.
