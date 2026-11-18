# Kontrak API lokal

Base default http://127.0.0.1:8765. `/api/session` memberikan token UI lokal. API lain memerlukan `Authorization: Bearer <token>`. POST menggunakan application/json, maksimum 200.000 byte. Tidak ada CORS publik.

| Method | Path | Body / fungsi |
|---|---|---|
| GET | /api/state | Tim, run, task (tanpa output), ringkasan memori, 100 kejadian terbaru |
| GET | /api/brain?q=kata | Sumber dan notes; UI dapat melihat proposal pending/rejected |
| GET | /api/tasks/{id} | Output dan snapshot satu task |
| POST | /api/runs | `{ "team":"creative", "title":"Brief", "items":["item A","item B"] }` |
| POST | /api/cancel | `{ "id":"run_id" }` |
| POST | /api/approve | `{ "id":"run_id" }`; hanya awaiting_approval |
| POST | /api/memory/propose | `{ "title":"Aturan", "content":"Isi", "source":"user" }` |
| POST | /api/memory/decide | `{ "id":"note_id", "decision":"approved" }`; alternatif rejected |
| POST | /api/memory/sync | `{}` |
| POST | /api/progress | `{ "id":"task_id", "progress":40, "message":"Milestone nyata" }` |

Run create maksimal 32 item; judul 2000 karakter, item 4000 karakter. Antrean maksimal 20 run. History UI/API state dibatasi 100 run terbaru; database menyimpan run lama. Tidak ada delete/publish endpoint.

MCP bridge menggunakan JSON-RPC 2.0 newline stdio dan metode initialize, ping, tools/list, tools/call. Ia mengumumkan capabilities.tools; tidak menyediakan resources/prompts/HTTP MCP transport. Notifications tidak mendapat respons. stdout hanya JSON-RPC. URI endpoint NEXUS_URL dibatasi loopback HTTP.

Contoh argumen tool `office_progress` pada gateway:

```json
{"task_id":"ID_DARI_PROMPT","progress":50,"message":"Transkrip selesai; memeriksa caption"}
```

Perluas adapter/protokol hanya berdasarkan versi Hermes lokal yang benar-benar teruji. `tests/test_office.py` melakukan handshake stdio dan tool read melalui server lokal sebagai kontrak dasar; ini tidak menggantikan tes integrasi dengan aplikasi Hermes asli.
