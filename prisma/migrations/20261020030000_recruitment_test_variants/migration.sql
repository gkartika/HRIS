-- AlterTable
ALTER TABLE "RecruitmentTestType" ADD COLUMN     "excellentScore" INTEGER,
ADD COLUMN     "monospace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variantGroup" TEXT;

-- Ketelitian becomes two alternative sets (Set A / Set B, one per applicant), plus Logika Dasar.
-- Content from the HC spec "Bank Soal v5": 30 questions per set (25 standard + 5 very hard), 10 points each,
-- pass 80%, "Istimewa" from 90%, 15 minutes. Logika Dasar: 30 minutes, pass 80%, questions are added in the app.
UPDATE "RecruitmentTestType" SET "name" = 'Ketelitian Set A', "description" = 'Bandingkan Teks A dan Teks B huruf demi huruf. Pilih SAMA jika keduanya persis sama (huruf besar dan kecil, tanda baca, spasi, dan angka). Pilih TIDAK jika ada perbedaan sekecil apa pun.', "passScore" = 80, "timeLimitMinutes" = 15,
  "variantGroup" = 'Ketelitian', "monospace" = true, "excellentScore" = 90, "sortOrder" = 2, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'rtt_ketelitian';
INSERT INTO "RecruitmentTestType" ("id", "name", "description", "form", "passScore", "timeLimitMinutes", "isGate", "variantGroup", "monospace", "excellentScore", "sortOrder", "active", "updatedAt") VALUES
  ('rtt_ketelitian_b', 'Ketelitian Set B', 'Bandingkan Teks A dan Teks B huruf demi huruf. Pilih SAMA jika keduanya persis sama (huruf besar dan kecil, tanda baca, spasi, dan angka). Pilih TIDAK jika ada perbedaan sekecil apa pun.', 'MULTIPLE_CHOICE', 80, 15, false, 'Ketelitian', true, 90, 2, true, CURRENT_TIMESTAMP),
  ('rtt_logika_dasar', 'Logika Dasar', 'Pilih satu jawaban yang paling tepat untuk setiap soal.', 'MULTIPLE_CHOICE', 80, 30, false, NULL, false, NULL, 3, true, CURRENT_TIMESTAMP);
UPDATE "RecruitmentTestType" SET "sortOrder" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'rtt_studi_kasus';

INSERT INTO "RecruitmentTestQuestion" ("id", "testTypeId", "sortOrder", "prompt", "options", "correctIndex", "reverseScored", "active") VALUES
  ('rtq_ket_a_01', 'rtt_ketelitian', 1, 'Teks A: PT Cahaya Bukit Perunggu
Teks B: PT Cahaya Bukit Perunggu', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_02', 'rtt_ketelitian', 2, 'Teks A: jl.merdeka no.45, bandung
Teks B: Jl. Merdeka No.45, Bandung', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_03', 'rtt_ketelitian', 3, 'Teks A: 0812-3456-7890
Teks B: 0812-3456-7890', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_04', 'rtt_ketelitian', 4, 'Teks A: INV/2026/09/00231
Teks B: INV/2026/09/00231', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_05', 'rtt_ketelitian', 5, 'Teks A: budi.santoso@cbp.co.id
Teks B: budi.santoso@cbp.co.id', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_06', 'rtt_ketelitian', 6, 'Teks A: QX7284-ALPHA
Teks B: QX7284-ALFA', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_07', 'rtt_ketelitian', 7, 'Teks A: 17 Agustus 1945
Teks B: 17 Agustus 1945', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_08', 'rtt_ketelitian', 8, 'Teks A: No. KTP: 3201145607890002
Teks B: No. KTP: 3201145607890003', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_09', 'rtt_ketelitian', 9, 'Teks A: www.cahayabukitperunggu.com
Teks B: www.cahayabukitperunggu.com', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_10', 'rtt_ketelitian', 10, 'Teks A: CV. Mitra Sejahtera Abadi
Teks B: CV. Mitra Sejahtra Abadi', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_11', 'rtt_ketelitian', 11, 'Teks A: 99.875.432-1-012.000
Teks B: 99.875.432-1-012.000', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_12', 'rtt_ketelitian', 12, 'Teks A: Rp 12.750.000,-
Teks B: Rp 12.570.000,-', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_13', 'rtt_ketelitian', 13, 'Teks A: Departemen Quality Control
Teks B: Departemen Quality Control', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_14', 'rtt_ketelitian', 14, 'Teks A: SN: 884HJ-203KD-991PL
Teks B: SN: 884HJ-203KD-991PI', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_15', 'rtt_ketelitian', 15, 'Teks A: Gedung B Lantai 3, Ruang 302
Teks B: Gedung B Lantai 3, Ruang 302', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_16', 'rtt_ketelitian', 16, 'Teks A: pt_logistik_nusantara
Teks B: pt-logistik_nusantara', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_17', 'rtt_ketelitian', 17, 'Teks A: 08123456789
Teks B: 081234567890', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_18', 'rtt_ketelitian', 18, 'Teks A: Nomor Referensi: HC/2026/1187
Teks B: Nomor Referensi: HC/2026/1187', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_19', 'rtt_ketelitian', 19, 'Teks A: Surabaya, Jawa Timur
Teks B: Surabaya, Jawa Tengah', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_20', 'rtt_ketelitian', 20, 'Teks A: AXZ-998-plt
Teks B: AXZ-998-plt', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_21', 'rtt_ketelitian', 21, 'Teks A: #MejaKerja2026!
Teks B: #MejaKerja2026!', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_22', 'rtt_ketelitian', 22, 'Teks A: Rizky Ramadhan, S.T.
Teks B: Rizky Ramadhan, S.T', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_23', 'rtt_ketelitian', 23, 'Teks A: 08.00 - 17.00 WIB
Teks B: 08.00 - 17.00 WIB', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_24', 'rtt_ketelitian', 24, 'Teks A: lantai2.gudangutara@cbp.id
Teks B: lantai2.gudangutara@cbp.id', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_25', 'rtt_ketelitian', 25, 'Teks A: ISO 9001:2015
Teks B: ISO 9001:2105', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_26', 'rtt_ketelitian', 26, 'Teks A: ASM-2026-0417-QC-PASS-00118-REV02-LOT9934
Teks B: ASM-2026-0417-QC-PASS-00118-REV02-LOT9934', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_a_27', 'rtt_ketelitian', 27, 'Teks A: ASM-2026-0417-QC-PASS-00118-REV02-LOT9934
Teks B: ASM-2026-0417-QC-PASS-00118-REV02-LOT9394', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_28', 'rtt_ketelitian', 28, 'Teks A: Kode Akses: O1lI0Ol1
Teks B: Kode Akses: 01lI0Ol1', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_29', 'rtt_ketelitian', 29, 'Teks A: Jl. Raya Industri Kawasan Delta Silicon Blok F3 No. 12, Cikarang Selatan, Bekasi, Jawa Barat 17530
Teks B: Jl. Raya Industri Kawasan Delta Silicon Blok F3 No. 12, Cikarang Selatan, Bekasi, Jawa Barat 17350', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_a_30', 'rtt_ketelitian', 30, 'Teks A: SPEC: Material SS304, Tebal 2.0mm, Toleransi plus minus 0.05mm, Finishing Brushed #4, QC Grade A
Teks B: SPEC: Material SS304, Tebal 2.0mm, Toleransi plus minus 0.05mm, Finishing Brushed #4, QC Grade A', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_01', 'rtt_ketelitian_b', 1, 'Teks A: PT Mitra Logam Sejahtera
Teks B: PT Mitra Logam Sejahtera', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_02', 'rtt_ketelitian_b', 2, 'Teks A: No. SO: 2026/VII/0458
Teks B: No. SO: 2026/VII/0459', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_03', 'rtt_ketelitian_b', 3, 'Teks A: warehouse.utara@cbp.co.id
Teks B: warehouse.utara@cbp.co.id', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_04', 'rtt_ketelitian_b', 4, 'Teks A: Blok D No. 22, Cikarang
Teks B: Blok D No. 23, Cikarang', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_05', 'rtt_ketelitian_b', 5, 'Teks A: ISO 14001:2015
Teks B: ISO 14001:2015', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_06', 'rtt_ketelitian_b', 6, 'Teks A: 08562217834
Teks B: 08562127834', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_07', 'rtt_ketelitian_b', 7, 'Teks A: PO-2026-00987
Teks B: PO-2026-00987', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_08', 'rtt_ketelitian_b', 8, 'Teks A: Line Produksi 2 - Shift Malam
Teks B: Line Produksi 2 - Shift Malam', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_09', 'rtt_ketelitian_b', 9, 'Teks A: www.cbp-manufacturing.id
Teks B: www.cbp-manufaktur.id', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_10', 'rtt_ketelitian_b', 10, 'Teks A: MSDS Bahan Kimia B-12
Teks B: MSDS Bahan Kimia B-21', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_11', 'rtt_ketelitian_b', 11, 'Teks A: Kode Barang: RM-884-X
Teks B: Kode Barang: RM-884-X', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_12', 'rtt_ketelitian_b', 12, 'Teks A: Supervisor QC: Hendra W.
Teks B: Supervisor QC: Hendra W', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_13', 'rtt_ketelitian_b', 13, 'Teks A: Rp 45.600.000,-
Teks B: Rp 45.600.000,-', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_14', 'rtt_ketelitian_b', 14, 'Teks A: Jadwal Maintenance: 05/11/2026
Teks B: Jadwal Maintenance: 05/12/2026', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_15', 'rtt_ketelitian_b', 15, 'Teks A: Area Produksi B - Zona Aman
Teks B: Area Produksi B - Zona Aman', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_16', 'rtt_ketelitian_b', 16, 'Teks A: forklift_no.03
Teks B: forklift_no.3', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_17', 'rtt_ketelitian_b', 17, 'Teks A: 0813-9988-7765
Teks B: 0813-9988-7765', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_18', 'rtt_ketelitian_b', 18, 'Teks A: Lot Number: LN-2026-0734
Teks B: Lot Number: LN-2026-0743', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_19', 'rtt_ketelitian_b', 19, 'Teks A: Pengawas Gudang Bahan Baku
Teks B: Pengawas Gudang Bahan Baku', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_20', 'rtt_ketelitian_b', 20, 'Teks A: CV. Sumber Logam Mandiri
Teks B: CV. Sumber Logam Mandir', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_21', 'rtt_ketelitian_b', 21, 'Teks A: T: 24.5C, RH: 60%
Teks B: T: 24.5C, RH: 60%', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_22', 'rtt_ketelitian_b', 22, 'Teks A: Formulir FR-QC-02-11
Teks B: Formulir FR-QC-02-11', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_23', 'rtt_ketelitian_b', 23, 'Teks A: 081298765432
Teks B: 081298765423', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_24', 'rtt_ketelitian_b', 24, 'Teks A: Jl. Raya Industri No. 7B
Teks B: Jl. Raya Industri No. 7B', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_25', 'rtt_ketelitian_b', 25, 'Teks A: approval.manager@cbp.co.id
Teks B: aproval.manager@cbp.co.id', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_26', 'rtt_ketelitian_b', 26, 'Teks A: MSDS-REV03-B12-HAZMAT-CLASS3-UN1993-PKG-II
Teks B: MSDS-REV03-B12-HAZMAT-CLASS3-UN1993-PKG-II', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_27', 'rtt_ketelitian_b', 27, 'Teks A: MSDS-REV03-B12-HAZMAT-CLASS3-UN1993-PKG-II
Teks B: MSDS-REV03-B12-HAZMAT-CLASS3-UN1993-PKG-III', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_28', 'rtt_ketelitian_b', 28, 'Teks A: Barcode: 8B0O1l1O0B8
Teks B: Barcode: 8B0O1I1O0B8', ARRAY['SAMA', 'TIDAK'], 1, false, true),
  ('rtq_ket_b_29', 'rtt_ketelitian_b', 29, 'Teks A: Kompleks Pergudangan Marunda Center Blok C2 No. 45-47, Cilincing, Jakarta Utara 14150
Teks B: Kompleks Pergudangan Marunda Center Blok C2 No. 45-47, Cilincing, Jakarta Utara 14150', ARRAY['SAMA', 'TIDAK'], 0, false, true),
  ('rtq_ket_b_30', 'rtt_ketelitian_b', 30, 'Teks A: SPEC: Material SPCC, Tebal 1.5mm, Toleransi plus minus 0.03mm, Finishing Galvanized, QC Grade A
Teks B: SPEC: Material SPCC, Tebal 1.5mm, Toleransi plus minus 0.03mm, Finishing Galvanized, QC Grade B', ARRAY['SAMA', 'TIDAK'], 1, false, true);
