# Nexus Living Office · Penthouse v3

## Dasar desain

Acuan utama adalah screenshot pengguna dan overview v2 bertanggal 22 Oktober 2026: kantor isometrik low-poly, kaca perimeter, warna gelap kehijauan, koridor kayu, pusat Big Brain, dan skyline. Ini bukan perubahan ke gaya realistis atau antarmuka React. Geometri dibuat secara prosedural tanpa asset jarak jauh.

Ruangan 16 × 12 unit menggantikan ukuran acuan 14 × 11. Empat ruangan tetap mengelilingi sirkulasi tengah; luas lantai sekitar 40 × 32 unit. Jendela belakang tinggi, railing tipis, fasad tower di bawah lantai, dan 28 massa gedung membentuk konteks penthouse. Dinding sisi depan rendah agar karakter dan meja terbaca dari kamera isometrik.

| Ruang | Agen | Palet | Identitas dan objek |
|---|---|---|---|
| Academic Atelier | Atlas, Lyra | Lavender / cream | Rak referensi, meja manuskrip, tumpukan buku, tanaman, lounge baca |
| Engineering Studio | Axel, Echo, Nova, Pixel | Mint / graphite | Empat meja dual monitor, rak server dengan indikator, figur kecil, arcade |
| Mission Control | Orion | Amber / slate | Monitor pengawasan, meja supervisor, rak arsip, ruang obrolan |
| Observatory | Mira | Powder blue / navy | Globe, referensi, ruang membaca, workstation riset |

Setiap ruangan mendapat beanbag, arcade, dispenser, meja kopi, karpet, dan tanaman. Jitter dekorasi memakai seed tetap: tampilannya bervariasi tetapi tidak berubah mendadak saat render. Barang padat dan dinding berbagi data footprint dengan sistem navigasi. Kursi dan bagian depan beanbag adalah zona duduk yang sengaja bisa dimasuki.

## Perilaku dan gerakan

`idle → walk → lounge / drink / arcade / chat → idle`, dengan `running/reviewing/recovering → walk to assigned seat → typing` sebagai prioritas. Idle tidak membuat task backend. Task tetap berjalan di backend walau animasi dihentikan.

- Mengetik: pinggul pada kursi, paha horizontal, lutut menekuk, tangan bergerak bergantian di posisi keyboard. Tidak ada bouncing seluruh badan untuk meniru mengetik.
- Walk: A* empat arah, segment clearance, footprint diperbesar radius tubuh. Jalur gagal berarti menunggu, bukan teleport.
- Agen lain menghalangi: tunggu sebentar lalu hitung ulang jalur dengan collider dinamis. Reservasi anchor mencegah dua agen memakai arcade/dispenser yang sama.
- Percakapan: sepasang agen bertemu; dua bubble muncul bergiliran. Agen di ruangan tunggal dapat mendatangi area obrolan tim lain melalui pintu.
- Big Brain: event `brain.read` atau `snapshot.applied` membuat dua partikel melengkung di atas dinding. Tidak ada perjalanan fisik ke brain dan tidak ada pulse palsu hanya karena polling.
- Chat dibatalkan ketika agen mulai task. Maksimal satu percakapan / dua bubble secara bersamaan.

Karakter memakai skin low-poly terinspirasi daftar anime yang diminta, bukan model detail berlisensi dari game. Delapan skin aktif: Deku, Choso, Levi, Archer, Eren, Shinei, Saber, Lancer. Asta tersedia sebagai varian cadangan. Identitas, ID, dan profil Hermes dipisahkan dari skin.

## Waktu dan suasana

Auto membaca jam browser lokal: pagi/siang 06–15, sore 16–18, malam 19–05. Pilihan manual Pagi/Sore/Malam tersedia di preview dan API view. Warna langit serta intensitas key light dan hemisphere light bertransisi. Material layar dan aksen tetap berpijar. Tidak memakai HDRI besar, bloom, atau postprocessing.

## Kinerja dan aksesibilitas

- Target render 30 FPS; DPR maksimum 1.25, atau 1 pada kualitas low. Tidak ada real-time shadow.
- Perabot statis memakai InstancedMesh, geometri dan material berbagi cache. Partikel dibatasi 16 mesh, dedupe event dibatasi 512 ID.
- UI memakai 13 label dasar dan maksimal dua bubble; isi eksternal melalui textContent, bukan innerHTML.
- Tab tersembunyi/viewport tersembunyi: RAF dihentikan; tidak mengejar delta waktu besar ketika kembali.
- ResizeObserver memperbarui ukuran renderer/proyeksi hanya ketika ukuran valid. Tidak memakai ukuran nol dan tidak menulis ulang posisi/target/zoom kamera saat kembali dari Kanban.
- Mount idempotent per elemen; dispose membersihkan RAF, observer, event, controls, dan sumber daya GPU.
- `prefers-reduced-motion` menghentikan animasi; kontrol orbit tetap tersedia. Tombol Motion tidak menghentikan task Hermes.

Target FPS adalah sasaran desain, bukan hasil benchmark laptop pengguna. Verifikasi di perangkat asli melalui diagnostics dan browser performance profiler. Bila perlu gunakan low, turunkan frame cap, lalu ukur kembali; jangan mengganti logic scheduler untuk mengoptimalkan gambar.
