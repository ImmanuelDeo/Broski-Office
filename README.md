# Nexus · Hermes Virtual Office — Broski-Office

Software virtual office multi-agent (NEXUS) untuk mengelola agen AI kreatif dan ruang kerja digital. Repositori ini menyatukan seluruh source code, aset, dokumentasi, dan modul `ai-creative-team` (sebelumnya repo terpisah milik `bekhruztbx`) menjadi satu repo utuh.

Mulai dari [START_HERE.md](START_HERE.md). Untuk menyerahkan setup kepada Hermes lokal, gunakan [HERMES_HANDOFF.md](HERMES_HANDOFF.md).

## Struktur

```
nexus-office/   (repo: Broski-Office)
├── ai-creative-team/    # Modul agen kreatif (Claude Code agent team)
├── assets/              # Aset visual (output contoh .mp4 TIDAK disertakan)
├── config/              # Konfigurasi (office.local.json TIDAK disertakan)
├── docs/                # Dokumentasi
├── models/              # Model/skema
├── nexus_addon/         # Addon inti
├── prompts/             # Template prompt
├── scripts/             # Skrip utilitas
├── tests/               # Unit test
├── visual-backups/      # Backup visual langkah pengembangan
├── web/                 # Frontend web
├── core.py              # Entry point inti
├── mcp_server.py        # Server MCP
├── server.py            # Server utama (default demo mode)
└── start.sh / start.ps1 # Launcher
```

## Cara Menjalankan

```bash
python server.py
```

Buka http://127.0.0.1:8765. Default mode demo. Live memerlukan konfigurasi dan pengujian pada instalasi Hermes milik pengguna. Rincian di docs/REFERENCE_AND_LIMITS.md.

## Reproduksibilitas & Setup dari Clone

```bash
# 1. Clone
git clone https://github.com/ImmanuelDeo/Broski-Office.git
cd Broski-Office

# 2. Setup Python
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt   # jika ada

# 3. Jalankan
python server.py   # atau: ./start.sh / start.ps1
```

Catatan:
- `assets/infer_output.mp4` dan `web/infer_output.mp4` (>100 MB) TIDAK disertakan di repo — keduanya output contoh; silakan diregenerasi atau disalin ulang bila dibutuhkan.
- `.runtime/` dan `config/office.local.json` berisi state lokal pengguna, tidak disertakan.
- Modul `ai-creative-team` diimpor dari repo `https://github.com/bekhruztbx/ai-creative-team` (versi original) — isi di sini adalah salinan kerja yang dipakai proyek ini.
