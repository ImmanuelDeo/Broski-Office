# Referensi dan batas verifikasi

Ditinjau pada 21 Oktober 2026.

| Referensi | Hasil akses | Penggunaan |
|---|---|---|
| https://www.youtube.com/watch?v=t0hGE-aaAds&t=86s | Akses video diblokir lingkungan; frame/transkrip tidak berhasil diperoleh | Desain mengacu pada deskripsi pengguna, bukan klaim menyalin frame |
| https://github.com/bekhruztbx/ai-creative-team | README utama terbaca melalui pencarian web; berkas implementasi langsung tidak berhasil diunduh | Pola editor per clip paralel, brand checker, shared memory dan tinjauan pengguna |
| https://hermes-agent.nousresearch.com/docs/user-guide/cli | Dokumentasi resmi terbaca | Query file, model CLI, peringatan semantik gateway |
| https://hermes-agent.nousresearch.com/docs/user-guide/profiles | Dokumentasi resmi terbaca | Profil terpisah per agen, penggunaan -p/--profile |
| https://hermes-agent.nousresearch.com/docs/user-guide/features/memory | Dokumentasi resmi terbaca | MEMORY.md/USER.md, frozen snapshot, larangan memakai satu home untuk beberapa writer |
| https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp | Dokumentasi resmi terbaca | Konfigurasi mcp_servers, command/args/env |
| https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways | Dokumentasi resmi terbaca | Gateway standalone dan perbedaan lifecycle multiplexer |

## Adaptasi yang dibuat

Creative Studio adalah adaptasi mekanisme, bukan port source upstream yang identik. Runtime asli menggunakan Claude Code dan memory MCP JSONL. Runtime paket ini menggunakan scheduler Python, profil Hermes, snapshot read-only, notes SQLite dan MCP bridge. Upstream tetap dipakai untuk tools media setelah diambil oleh instalasi lokal. Batas izin .claude/settings.json tidak otomatis berlaku pada Hermes; profil Hermes harus dikonfigurasi tersendiri.

Research, Engineering dan Operations adalah contoh tim tambahan buatan paket ini, bukan nama tim yang diklaim ada di video. Nama Eren Yeager/Shinei Nouzen/Sage dan karakter lainnya juga rancangan awal. Semua label dapat diedit.

## Belum dapat dinyatakan terverifikasi

- Kemiripan 90% dengan video, teks persis, geometri/animasi persis.
- Hubungan langsung dengan cache pengguna yang belum diberikan path/formatnya.
- Eksekusi model Hermes nyata, provider autentikasi, tool policy, gateway stop pada laptop pengguna.
- Produksi clip dengan tools upstream, karena dependencies/media tidak tersedia di lingkungan pembuatan.
- Jalur GPU WebGL secara visual pada browser pengujian (browser ini tidak menyediakan WebGL); renderer CPU diuji lewat UI, geometri dan shader diperiksa dalam kode.
- Throughput/fps pada laptop pengguna, hasil media, kualitas jawaban model, biaya token atau akurasi verdict reviewer.

## Batas produk versi ini

Tidak ada semantic vector search, graph reasoning, KV-cache sharing, sinkronisasi dua arah Hermes memory, multiplayer, akun multiuser, publish/deploy otomatis, autonomous room creation dari percakapan, GLB/VRM loader, atau tracing semua tool calls. Penambahan tim melalui konfigurasi/script langsung menghasilkan ruangan baru setelah restart. Tugas paralel di dalam satu run, sedangkan run tim lain mengantre untuk membatasi beban laptop.

Pratinjau memori menampilkan maksimum 16.000 karakter per file. Sumber yang lebih besar tetap memiliki ukuran aktual dan status yang jelas. Snapshot serta MCP responses memiliki batas terpisah yang dijelaskan pada arsitektur. Jangan menyamakan badge kapasitas dengan jumlah konteks yang benar-benar diterima sebuah model.
