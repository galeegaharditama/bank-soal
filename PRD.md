# PRD — Bank Soal SD

**Status:** draft v1 · 22 November 2026
**Bentuk:** web statis (PWA) + Google Sheets sebagai sumber soal
**Ringkas:** satu bank soal untuk SD, dikelola guru di Google Sheets, dipakai siswa di HP dengan
satu alur bebas — jawab sesuai urutan sendiri, koreksi di akhir — tanpa akun dan tanpa server.

---

## 1. Masalah

Soal latihan SD hari ini berpindah-pindah: difoto dari buku, dikirim lewat grup WhatsApp, atau
diketik ulang ke Google Form setiap kali ulangan. Akibatnya:

- Soal tidak pernah terkumpul jadi satu bank yang bisa dipakai ulang.
- Siswa tidak tahu salahnya di mana sampai guru membahas di kelas.
- Guru mengulang pekerjaan mengetik soal yang sama setiap tahun.
- Google Form bisa mengumpulkan nilai, tapi tidak bisa dijadikan latihan mandiri dengan pembahasan.

## 2. Tujuan

1. Guru mengelola soal di tempat yang sudah dikuasainya (Google Sheets), sekali tulis, dipakai
   berkali-kali.
2. Siswa bisa mengerjakan kapan saja di HP, dengan kebebasan melewati dan kembali ke soal mana pun,
   lalu mendapat koreksi lengkap di akhir.
3. Nilai tidak bocor selama mengerjakan, supaya hasilnya mencerminkan kemampuan sendiri.
4. Berjalan tanpa biaya bulanan, tanpa login, dan tetap bisa dipakai saat internet lemah.

**Bukan tujuan v1:** menggantikan penilaian resmi sekolah, menjadi rekap nilai untuk guru, atau
menjadi platform kelas.

## 3. Persona

| Persona | Kebutuhan | Konsekuensi desain |
|---|---|---|
| **Siswa kelas 1–2** | Belum lancar membaca, mengetik di HP sering salah | Sesi 5 soal, soal PG, teks besar, tombol tinggi |
| **Siswa kelas 3–6** | Bisa mandiri, ingin menantang diri dan melihat skor | Sesi 10–20 soal, review lengkap, riwayat skor |
| **Guru penyedia soal** | Nyaman di Sheets, tidak mau belajar tool baru | Kolom sederhana, validasi berteriak saat ada yang salah |
| **Orang tua** | Tidak butuh akun, hanya mendampingi | Tidak ada login, tidak ada data pribadi siswa |

## 4. Satu alur

Tidak ada mode. Semua sesi berjalan sama: soal ditampilkan satu per satu, siswa bebas **melewati**,
**kembali**, dan melompat lewat **deret nomor**. Jawaban bisa diubah sampai menekan *Selesai*.

Selama mengerjakan, **tidak ada satu pun tanda benar/salah** dan tidak ada pembahasan. Koreksi
muncul seluruhnya di akhir.

| Aspek | Perilaku |
|---|---|
| Navigasi | Maju, kembali, lewati, lompat lewat deret nomor |
| Ubah jawaban | Bebas sampai *Selesai* |
| Deret nomor | Membedakan "sudah dijawab" dan "belum", tanpa membocorkan benar/salah |
| Pembahasan | Setelah *Selesai*, untuk semua soal |
| Skor | Setelah *Selesai* |
| Timer | Tidak ada di v1 |

**Kenapa tidak ada mode latihan instan:** satu alur lebih sedikit kode, lebih sedikit pilihan yang
membingungkan anak, dan hasilnya bisa dipercaya sebagai ukuran. Nilai belajarnya dipindahkan ke
dua tempat: **review akhir** (semua soal + pembahasan) dan **Ulangi yang salah**.

**Kenapa tidak semua soal dalam satu halaman:** 20 soal + gambar + pembahasan menjadi halaman
panjang di HP, sulit dilacak, dan siswa kehilangan jejak sudah sampai mana. Satu kartu per soal
dengan deret nomor memberi kebebasan yang sama tanpa kehilangan fokus.

### 4.1 Aturan penilaian

- **PG:** jawaban disimpan sebagai huruf `A`–`D`; cocok persis.
- **Isian:** dibandingkan tanpa membedakan huruf besar/kecil dan spasi berlebih. Satu soal boleh
  punya beberapa jawaban benar, dipisah `|` (contoh: `mencair|melebur`).
- **Skor:** jumlah jawaban benar dari total soal. Tidak ada pengurangan nilai.
- **Soal kosong** (tidak dijawab) dihitung salah dan ditandai di review.

### 4.2 Batasan "tanpa bocoran" — dinyatakan terbuka

Kunci disembunyikan di **antarmuka**, bukan di file. `jawaban` tetap ada di `data/soal.json` dan
bisa dibaca lewat devtools.

Keputusan: **diterima** untuk v1, karena nilai tidak dipakai untuk rapor. Kalau nanti nilai harus
dipercaya, pengecekan wajib pindah ke server (lihat §8).

## 5. Alur

1. Pilih mapel, kelas, bab (boleh "Semua"), dan jumlah soal (5/10/20).
2. Kerjakan:
   - **Maju** tanpa menjawab = soal dilewati dan bisa dikerjakan nanti.
   - **Kembali** ke soal sebelumnya kapan saja; jawaban bisa diubah.
   - **Deret nomor** menunjukkan posisi dan status tiap soal; ketuk untuk melompat.
   - Tidak ada tanda benar/salah dan tidak ada pembahasan selama sesi.
3. **Selesai** bisa ditekan kapan saja. Kalau masih ada soal kosong, minta konfirmasi dan sebutkan
   berapa yang belum dijawab.
4. Hasil: skor, review seluruh soal (jawabanmu, kunci, pembahasan), lalu **Ulangi**,
   **Ulangi yang salah**, atau **Ganti pilihan**.

### 5.1 Keadaan khusus

| Keadaan | Perilaku |
|---|---|
| Filter tidak menghasilkan soal | Pesan "Belum ada soal untuk pilihan ini", tombol mulai tidak aktif |
| Soal tersedia < jumlah diminta | Pakai semua yang ada, tampilkan jumlah sebenarnya |
| Selesai dengan soal kosong | Konfirmasi menyebut jumlah yang belum dijawab |
| Keluar di tengah sesi | Konfirmasi; keluar membuang sesi (tidak ada simpan progres) |
| Offline setelah kunjungan pertama | App dan soal terakhir tetap bisa dipakai |
| Soal bergambar gagal dimuat | Teks soal tetap tampil; gambar disembunyikan |

## 6. Data soal

Sumber tunggal: satu tab Sheet (default `soal`). Kolom:

`id, mapel, kelas, bab, tipe, soal, gambar, opsi_a, opsi_b, opsi_c, opsi_d, jawaban, pembahasan, aktif`

| Aturan | Konsekuensi kalau dilanggar |
|---|---|
| `id` unik dan tidak kosong | build ditolak, baris disebut |
| `kelas` bilangan bulat 1–6 | build ditolak |
| `tipe` hanya `pg` atau `isian` | build ditolak |
| PG minimal 2 opsi terisi, `jawaban` menunjuk opsi yang ada | build ditolak |
| `pembahasan` wajib | build ditolak |
| `aktif = tidak` | baris dilewati tanpa divalidasi (draft) |
| Kolom `kelas`, `jawaban`, `opsi_*` harus Plain text | `12` bisa berubah jadi `12,00`, `1,5` jadi tanggal |

Hasil sync: `data/soal.json` dengan `versi` (timestamp) dan `jumlah`. Tanggal `versi` ditampilkan
di header app sebagai bukti data terbaru sudah masuk.

## 7. Operasi konten

Ini bagian yang menentukan produk ini berguna atau tidak, bukan kodenya.

- **Target isi:** minimal 20–30 soal per bab supaya siswa tidak menghafal urutan. Untuk rilis awal:
  satu mapel, satu kelas, dua bab yang lengkap lebih baik daripada 45 soal tersebar.
- **Alur:** guru menulis dengan `aktif = tidak` → direview (kunci benar, pembahasan masuk akal,
  bahasa sesuai kelas) → ubah ke `ya` → sync.
- **Penulisan soal:** satu ide per soal, opsi pengecoh yang masuk akal, pembahasan menjelaskan
  *mengapa*, bukan mengulang jawaban.
- **Jangan** menyimpan jawaban atau nilai siswa di Sheet.

## 8. Non-goals v1

- Akun siswa/guru, kode kelas, rekap nilai otomatis (butuh backend + database).
- Mode latihan dengan pembahasan instan per soal. Koreksi sengaja dikumpulkan di akhir.
- Timer atau batas waktu.
- Soal esai, menjodohkan, atau audio.
- Upload gambar dari dalam app (gambar lewat Sheet).
- Analitik terpusat; metrik hanya tersedia lokal di perangkat.
- Multi-bahasa.

## 9. Kriteria terima

Dianggap selesai kalau semua ini benar:

**Sesi**
- [ ] Bisa melewati soal tanpa menjawab lalu kembali ke soal itu belakangan.
- [ ] Jawaban bisa diubah sampai *Selesai*.
- [ ] Deret nomor soal menunjukkan status tiap soal dan bisa diketuk untuk melompat.
- [ ] Tidak ada penanda benar/salah maupun pembahasan selama sesi.
- [ ] *Selesai* dengan soal kosong meminta konfirmasi dan menyebut jumlahnya.
- [ ] Skor baru muncul setelah *Selesai*.
- [ ] Review akhir memuat semua soal, jawaban siswa, kunci, dan pembahasan.
- [ ] Soal yang tidak dijawab dihitung salah dan ditandai di review.
- [ ] "Ulangi yang salah" hanya memuat soal yang salah pada sesi itu.

**Bersama**
- [ ] Jumlah soal 5/10/20 dihormati; kalau kurang, pakai semua yang ada.
- [ ] Filter kosong memberi pesan, bukan layar kosong.
- [ ] Riwayat menyimpan filter, skor, dan id soal yang salah (maks 20 entri, tampil 5).
- [ ] Impor menolak baris yang melanggar aturan dan tidak menulis apa pun sebelum ditekan *Impor*.
- [ ] Setelah kunjungan pertama, app terbuka tanpa jaringan.
- [ ] Semua tombol bisa dijangkau dengan jempol dan punya label teks (bukan hanya warna).

**Ekspor**
- [ ] Ekspor CSV mengikuti filter mapel/kelas dan kotak cari yang sedang aktif.
- [ ] Ekspor dari bilah pilihan hanya memuat baris yang dicentang.
- [ ] File hasil ekspor bisa diimpor kembali tanpa kehilangan isi, termasuk draf (`aktif = tidak`).
- [ ] Nama file menyebut mapel, kelas, dan tanggal.

## 10. Metrik

Tanpa backend, metrik hanya bisa dilihat di perangkat sendiri. Yang berguna:

- Jumlah sesi per minggu (indikator dipakai atau tidak).
- Rata-rata skor per kelas/mapel.
- Soal yang paling sering salah → daftar untuk ditinjau guru (indikator soal ambigu, bukan siswa
  bodoh).

Agregasi lintas siswa **tidak** termasuk v1. Itu konsekuensi dari pilihan "tanpa login".

## 11. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kunci jawaban ada di file | siswa bisa curang lewat devtools | diterima untuk latihan mandiri; pindah ke server kalau nilai dipakai rapor |
| Umpan balik tertunda | siswa mengulang kesalahan yang sama tanpa sadar | sesi pendek (5 untuk kelas 1–2), review akhir dengan pembahasan, dan "Ulangi yang salah" |
| Kualitas soal | siswa belajar hal yang salah | review sebelum `aktif`; pembahasan wajib; tombol lapor soal (v1.2) |
| Endpoint `gviz` tidak resmi | sync bisa berhenti | satu fungsi pengambil data; ganti ke ekspor CSV/XLSX |
| Cron GitHub telat/mati | soal baru tidak masuk | tombol *Run workflow* manual |
| Ikon SVG ditolak Android | tidak bisa install | sediakan PNG 192/512 kalau perlu |
| Sheet dirusak editor | data busuk | validasi berhenti sebelum tulis; git menyimpan versi sebelumnya |

## 12. Rencana rilis

| Versi | Isi | Status |
|---|---|---|
| **v0.9** | Versi pertama: latihan dengan pembahasan per soal, 45 soal contoh, filter mapel/kelas/bab, riwayat lokal, PWA, sync + validasi | digantikan v1.0 |
| **v1.0** | Satu alur bebas (lewati, kembali, deret nomor), koreksi di akhir, pilihan jumlah soal, review lengkap, "ulangi yang salah" | sudah ada |
| **v1.1** | Ekspor CSV (ikuti filter atau baris terpilih), impor CSV, data di Supabase | sudah ada |
| **v1.2** | Tombol lapor soal, ikon PNG, rapikan tampilan hasil | berikutnya |
| **v2** | Rekap untuk guru | hanya jika ada kebutuhan nyata + backend |

## 13. Prinsip desain

- **Satu layar, satu tugas.** Tidak ada menu; alurnya pilih → kerjakan → hasil.
- **Teks besar, tombol tinggi.** Minimum 48 px, bisa disentuh jempol.
- **Jangan andalkan warna saja.** Benar/salah selalu disertai kata.
- **Tanpa animasi yang memperlambat.** Transisi pendek, hormati `prefers-reduced-motion`.
- **Bahasa Indonesia sederhana**, sesuai tingkat kelas soal.
