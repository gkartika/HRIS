-- Standar penilaian interview: definition and the meaning of 2, 4, 6, 8, 10 for each aspect, copied from the workbook
-- "Matriks Penilaian Hasil Wawancara Calon Tenaga Kerja".
-- Additive: new columns (all nullable), one new table, three nullable settings columns. The only change to existing rows
-- is the name of the interview aspects (now the names of the workbook) and the definition/note/standard link on them.
-- Scores already given keep the name they were given under (aspectLabel), and none exist on these aspects yet.

ALTER TABLE "RecruitmentInterviewAspect"
  ADD COLUMN "definition" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "standardOfId" TEXT;

ALTER TABLE "RecruitmentInterviewAspect" ADD CONSTRAINT "RecruitmentInterviewAspect_standardOfId_fkey" FOREIGN KEY ("standardOfId") REFERENCES "RecruitmentInterviewAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RecruitmentAspectLevel" (
    "id" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "RecruitmentAspectLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecruitmentAspectLevel_aspectId_score_key" ON "RecruitmentAspectLevel"("aspectId", "score");

ALTER TABLE "RecruitmentAspectLevel" ADD CONSTRAINT "RecruitmentAspectLevel_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "RecruitmentInterviewAspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The header of the document (filled in on screen by Admin Rekrutmen; empty in the workbook)
ALTER TABLE "RecruitmentSetting"
  ADD COLUMN "standardDocNumber" TEXT,
  ADD COLUMN "standardRevision" TEXT,
  ADD COLUMN "standardEffectiveDate" TEXT;

-- 1. Pengetahuan Teknis
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Pengetahuan Teknis$q$, "definition" = $q$Pengetahuan praktis atau teoritis yang dikuasai dengan posisi yang dilamar.$q$ WHERE "id" = 'ria_u_pengalaman';
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Pengetahuan Teknis$q$, "definition" = $q$Pengetahuan praktis atau teoritis yang dikuasai dengan posisi yang dilamar.$q$, "standardOfId" = 'ria_u_pengalaman' WHERE "id" = 'ria_h_pengalaman';
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pengalaman_2', 'ria_u_pengalaman', 2, $q$Tidak menguasai pengetahuan dasar yang dibutuhkan posisi yang dilamar dan tidak dapat menjawab pertanyaan teknis.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pengalaman_4', 'ria_u_pengalaman', 4, $q$Memahami sebagian kecil pengetahuan dasar, namun jawaban sering kurang tepat atau tidak lengkap.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pengalaman_6', 'ria_u_pengalaman', 6, $q$Memahami konsep dan proses kerja dasar serta mampu menjelaskan penerapannya. Namun, masih membutuhkan arahan dalam menangani pekerjaan teknis yang lebih kompleks.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pengalaman_8', 'ria_u_pengalaman', 8, $q$Menguasai pengetahuan teknis sesuai posisi, mampu menerapkan prosedur kerja dengan baik, memahami tools yang digunakan, dan dapat menyelesaikan permasalahan teknis secara mandiri.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pengalaman_10', 'ria_u_pengalaman', 10, $q$Memiliki penguasaan teknis yang mendalam, mampu menangani permasalahan kompleks, memberikan solusi efektif, melakukan evaluasi, serta mengembangkan metode atau proses kerja yang lebih baik.$q$);

-- 2. Keterampilan Teknis
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Keterampilan Teknis$q$, "definition" = $q$Kemampuan mengatasi permasalahan yang mungkin terjadi pada posisi yang dilamar.$q$ WHERE "id" = 'ria_u_teknis';
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Keterampilan Teknis$q$, "definition" = $q$Kemampuan mengatasi permasalahan yang mungkin terjadi pada posisi yang dilamar.$q$, "standardOfId" = 'ria_u_teknis' WHERE "id" = 'ria_h_teknis';
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_teknis_2', 'ria_u_teknis', 2, $q$Tidak mampu menunjukkan keterampilan praktis yang dibutuhkan untuk posisi. Kesulitan menggunakan tools atau menjalankan tugas dasar meskipun telah diberikan arahan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_teknis_4', 'ria_u_teknis', 4, $q$Memiliki keterampilan dasar, tetapi belum mampu menerapkannya secara konsisten. Masih sering melakukan kesalahan dan membutuhkan pendampingan intensif.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_teknis_6', 'ria_u_teknis', 6, $q$Mampu menjalankan tugas teknis dasar sesuai instruksi. Dapat menggunakan tools atau sistem kerja, tetapi masih membutuhkan arahan untuk pekerjaan yang lebih kompleks.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_teknis_8', 'ria_u_teknis', 8, $q$Terampil menjalankan pekerjaan secara mandiri, mampu menggunakan tools atau sistem dengan baik, teliti, serta menghasilkan pekerjaan sesuai standar dan target.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_teknis_10', 'ria_u_teknis', 10, $q$Sangat mahir dalam menjalankan pekerjaan teknis, mampu menangani tugas kompleks, bekerja secara efektif dan akurat, serta mampu mengoptimalkan atau meningkatkan proses kerja.$q$);

-- 3. Kemampuan Komunikasi
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Kemampuan Komunikasi$q$, "definition" = $q$Kemampuan berkomunikasi dua arah, yaitu mendengarkan secara aktif untuk memahami maksud lawan bicara dengan benar, lalu mengungkapkan ide atau tanggapan secara sistematis sehingga dapat dipahami dengan benar.$q$ WHERE "id" = 'ria_u_komunikasi';
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Kemampuan Komunikasi$q$, "definition" = $q$Kemampuan berkomunikasi dua arah, yaitu mendengarkan secara aktif untuk memahami maksud lawan bicara dengan benar, lalu mengungkapkan ide atau tanggapan secara sistematis sehingga dapat dipahami dengan benar.$q$, "standardOfId" = 'ria_u_komunikasi' WHERE "id" = 'ria_h_komunikasi';
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_komunikasi_2', 'ria_u_komunikasi', 2, $q$Komunikasi tidak berjalan dua arah: sering memotong pembicaraan, tidak fokus, dan salah menangkap maksud pertanyaan, sehingga jawaban yang disampaikan tidak jelas, tidak runtut, dan sering membuat pewawancara salah paham.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_komunikasi_4', 'ria_u_komunikasi', 4, $q$Mendengarkan namun kurang fokus, sehingga pertanyaan sering perlu diulang. Ide sederhana dapat disampaikan, tetapi jawaban sering berbelit, tidak runtut, atau tidak sesuai dengan maksud pertanyaan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_komunikasi_6', 'ria_u_komunikasi', 6, $q$Umumnya memahami pertanyaan dan mampu menyampaikan ide yang dapat dipahami, namun belum menunjukkan mendengarkan aktif (jarang mengonfirmasi atau bertanya balik saat ragu) dan penyampaiannya belum selalu sistematis, sehingga perlu diperjelas dengan pertanyaan lanjutan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_komunikasi_8', 'ria_u_komunikasi', 8, $q$Mendengarkan secara aktif (fokus, tidak memotong pembicaraan, mengonfirmasi atau bertanya balik bila kurang jelas) sehingga memahami pertanyaan dengan tepat, lalu menanggapinya secara jelas, runtut, dan tepat sasaran. Mampu berkomunikasi sendiri dengan atasan, rekan kerja, maupun pihak lain tanpa perlu dibantu atau dijelaskan ulang.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_komunikasi_10', 'ria_u_komunikasi', 10, $q$Mendengarkan secara aktif dengan sangat baik (mampu merangkum inti pertanyaan dengan kata-kata sendiri dan menangkap maksud yang tersirat), lalu menanggapinya dengan sangat jelas, sistematis, dan meyakinkan, serta menyesuaikan penyampaian dengan lawan bicara secara mandiri.$q$);

-- 4. Pendekatan Kerja
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Pendekatan Kerja$q$, "definition" = $q$Penilaian terhadap cara kandidat dalam melaksanakan pekerjaan, mencakup inisiatif, tanggung jawab, kedisiplinan, kemampuan mengatur prioritas, pemecahan masalah, kolaborasi, serta kemampuan beradaptasi dalam mencapai target dan menyelesaikan tugas secara efektif dan efisien.$q$ WHERE "id" = 'ria_u_pendekatan';
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Pendekatan Kerja$q$, "definition" = $q$Penilaian terhadap cara kandidat dalam melaksanakan pekerjaan, mencakup inisiatif, tanggung jawab, kedisiplinan, kemampuan mengatur prioritas, pemecahan masalah, kolaborasi, serta kemampuan beradaptasi dalam mencapai target dan menyelesaikan tugas secara efektif dan efisien.$q$, "standardOfId" = 'ria_u_pendekatan' WHERE "id" = 'ria_h_pendekatan';
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pendekatan_2', 'ria_u_pendekatan', 2, $q$Tidak menunjukkan inisiatif dan tanggung jawab yang memadai. Cenderung pasif, membutuhkan arahan terus-menerus, serta kesulitan menyelesaikan pekerjaan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pendekatan_4', 'ria_u_pendekatan', 4, $q$Memiliki kemauan bekerja, tetapi masih bergantung pada arahan atasan. Kurang mampu menentukan prioritas dan menghadapi kendala pekerjaan secara mandiri.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pendekatan_6', 'ria_u_pendekatan', 6, $q$Mampu menjalankan tugas sesuai instruksi, bertanggung jawab terhadap pekerjaan, serta dapat bekerja sama. Namun, inisiatif dan kemampuan problem solving masih perlu dikembangkan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pendekatan_8', 'ria_u_pendekatan', 8, $q$Proaktif, bertanggung jawab, mampu mengatur prioritas, menyelesaikan masalah secara mandiri, serta memiliki kemampuan adaptasi dan kolaborasi yang baik.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_pendekatan_10', 'ria_u_pendekatan', 10, $q$Memiliki inisiatif dan ownership tinggi, berpikir strategis, antisipatif terhadap risiko, mampu memberikan solusi inovatif, serta konsisten menghasilkan pekerjaan berkualitas tanpa bergantung pada arahan.$q$);

-- 5. Percobaan Lapangan / kompetensi
UPDATE "RecruitmentInterviewAspect" SET "label" = $q$Percobaan Lapangan / kompetensi$q$, "definition" = $q$Kemampuan melaksanakan pekerjaan teknis di lapangan atau hasil tes kompetensi tertentu.$q$ WHERE "id" = 'ria_u_lapangan';
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_lapangan_2', 'ria_u_lapangan', 2, $q$Tidak mampu melaksanakan pekerjaan teknis yang diujikan, atau hasil tes kompetensi jauh di bawah standar.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_lapangan_4', 'ria_u_lapangan', 4, $q$Mampu melaksanakan sebagian kecil pekerjaan yang diujikan dengan banyak kesalahan dan sangat membutuhkan arahan. Hasil tes di bawah standar.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_lapangan_6', 'ria_u_lapangan', 6, $q$Mampu melaksanakan pekerjaan yang diujikan dengan hasil mendekati standar, namun masih terdapat kesalahan atau membutuhkan koreksi dan arahan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_lapangan_8', 'ria_u_lapangan', 8, $q$Mampu melaksanakan pekerjaan yang diujikan secara mandiri dari awal hingga selesai tanpa arahan, dengan hasil sesuai standar. Hasil tes kompetensi memenuhi standar yang ditetapkan.$q$);
INSERT INTO "RecruitmentAspectLevel" ("id", "aspectId", "score", "description") VALUES ('ral_u_lapangan_10', 'ria_u_lapangan', 10, $q$Mampu melaksanakan pekerjaan yang diujikan secara mandiri tanpa arahan dengan sangat baik, cepat, dan akurat. Parameter keberhasilan: hasil kerja melampaui standar mutu, waktu penyelesaian lebih cepat dari target, tanpa kesalahan, dan seluruh aturan K3 diterapkan dengan benar. Hasil tes kompetensi berada di atas nilai standar yang ditetapkan.$q$);

-- Aspect 4: the footer of the workbook
UPDATE "RecruitmentInterviewAspect" SET "note" = $q$Skor diberikan berdasarkan gambaran keseluruhan dari 5 nilai budaya CBP.$q$ WHERE "id" IN ('ria_u_pendekatan', 'ria_h_pendekatan');
