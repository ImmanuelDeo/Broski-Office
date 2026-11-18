# Acuan dan provenance

Diperiksa 22 Oktober 2026.

| Sumber | Penggunaan / batas |
|---|---|
| NEXUS_PENTHOUSE_V2_CODEBASE_OVERVIEW.md yang diunggah pengguna | Struktur proyek, stack r170/Python, ID/profil, memory read-only, endpoint, prosedur lokal. Bukan source code dan bukan bukti tes yang kami jalankan. |
| Screenshot 2026-10-22 104951.png yang diunggah pengguna | Referensi low-poly isometrik, 4 ruang, big brain, skyline, UI gelap dan panel inspector. |
| https://github.com/bekhruztbx/ai-creative-team | Referensi arsitektur worker paralel, reviewer, shared MCP memory, approval. Paket ini tidak menyalin kode repo itu. |
| https://www.youtube.com/watch?v=t0hGE-aaAds&t=86s | URL referensi pengguna. Video tidak berhasil diakses melalui layanan pengambilan web; tidak ada klaim penilaian kemiripan 90% terhadap video. Screenshot pengguna menjadi acuan visual utama. |
| https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver | Pengamatan ukuran container ketika layout berubah. |
| https://threejs.org/docs/ | Referensi API umum; implementasi/vendor tetap dipin r170. |
| https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js | Vendor Three.js r170 yang disertakan lokal. |
| https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js | OrbitControls r170; import bare `three` diganti `./three.module.js` agar tanpa bundler/import map. |
| https://cdn.jsdelivr.net/npm/three@0.170.0/LICENSE | Lisensi MIT vendor yang disertakan. |
| https://science.nasa.gov/venus/venus-facts/ | Seed fun facts: periode rotasi/orbit Venus dan tidak adanya bulan alami. |
| https://home.cern/science/computing/the-birth-of-the-web | Seed fakta sejarah Web pada 1989. |
| https://home.cern/science/computing/the-birth-of-the-web/where-web-was-born/ | Seed fakta website pertama dan komputer NeXT. |

Seed facts adalah parafrasa pendek. Balasan percakapan dapat berupa komentar ringan, bukan klaim bahwa agent benar-benar melakukan diskusi LLM. Berita aktual tidak disintesis tanpa bukti. Feed BBC/Antara/arXiv di konfigurasi adalah starter untuk diuji oleh Hermes lokal, bukan jaminan akses dari setiap jaringan.
