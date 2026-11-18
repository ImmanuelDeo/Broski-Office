# Menambah tim, agen dan tampilan

## Tambah tim tanpa edit source

```bash
python scripts/add_team.py --id policy --name "Policy Lab" --color "#92bfa5" --description "Analisis kebijakan dan pemeriksaan bukti"
```

Script memvalidasi konfigurasi, membuat backup JSON, lalu menambahkan worker dan reviewer. Restart kantor; ruangan, label, kartu tim, karakter, dan pilihan dispatcher dibuat otomatis. Buat profil Hermes baru dan pasang MCP sebelum menjalankan live.

Manifest mendukung sampai 24 tim dan 6 agen/tim. Ini batas validasi, bukan jaminan performa; GPU/laptop menentukan jumlah praktis. Mulai 4 tim dan 2 proses paralel. Ruangan ditempatkan empat per kelompok mengelilingi pusat; kelompok tambahan memperluas lantai. Kamera overview menyesuaikan luas. UI sidebar/kanban tidak membatasi tim pada empat.

## Peran agen

Field agen: id unik, name, role, stage (`worker` atau `reviewer`), profile unik, model, prompt, avatar. File prompt harus berada di proyek. Setiap tim memerlukan minimal satu worker dan satu reviewer. Untuk spesialis baru, buat file di prompts/ dan arahkan field prompt ke file tersebut. `role` saja hanya label; perilaku berasal dari isi prompt dan tool/skill profil Hermes.

Warna avatar: skin/hair/shirt dalam format #RRGGBB. Default menghasilkan karakter voxel sederhana. Nama karakter tidak menentukan model LLM. Model diatur terpisah lewat field model/default profil.

## Model 3D

`web/scene.js` adalah sumber model prosedural dan renderer. `Geometry` menyediakan box, sphere, tube, ring; OfficeScene.build membangun kantor dan OfficeScene.draw membangun karakter/otak dinamis. Ubah dimensi, posisi, warna dan bentuk pada sumber ini. Untuk ekspor ulang aset:

```bash
node scripts/export_models.mjs
```

Hasil: models/big-brain.obj, agent-base.obj, room-base.obj. OBJ dapat dibuka di Blender; warna per vertex memakai ekstensi RGB yang dukungannya berbeda antarimporter. Buat material di Blender bila importer mengabaikan warna. Model OBJ adalah aset editable pendamping; renderer saat ini memakai geometri prosedural, **tidak memuat ulang OBJ/GLB**. Avatar VRM/GLTF skeletal dan animasi skeletal belum diimplementasikan.

## Mencocokkan video

Gunakan frame referensi dari timestamp 01:26 dan beberapa sudut tambahan. Ukur susunan ruang, sudut kamera, proporsi karakter, palet, label, tipografi dan animasi. Parameter awal: yaw .55 rad, pitch .72 rad, scale 18, ruangan 10 × 8 unit. Ubah scene.js/style.css berdasarkan frame. Jangan menyebut 90% hanya berdasarkan kesan; dokumentasikan aspek yang dibandingkan dan yang belum sama.
