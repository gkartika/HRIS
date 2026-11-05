-- Standar penilaian Evaluasi Kinerja (FR-HC-01-07): definition and the meaning of every grade of each criterion, copied from the
-- owner's workbooks "Matriks Evaluasi Kinerja Karyawan CBP 2026 Skala 2-10" (Performance) and "CBP, Tata Nilai" (Tata Nilai).
-- Additive: nullable columns, two new tables, three nullable settings columns. The grades of Tata Nilai (0, 25, 50, 75, 100) and
-- the names of every criterion are not changed; no evaluation exists yet.

ALTER TABLE "EvaluationCriterion" ADD COLUMN "definition" TEXT, ADD COLUMN "note" TEXT;

-- Some criteria have more than one set of texts (Kepemimpinan: individual or with subordinates; Pengambilan Keputusan: by level).
-- The rule says who a version is for: a list of job levels (HL = Harian Lepas), or whether the person has people reporting to them.
CREATE TABLE "EvaluationCriterionVariant" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "appliesToLevels" TEXT,
    "appliesToSubordinates" BOOLEAN,

    CONSTRAINT "EvaluationCriterionVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationCriterionLevel" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT 'DEFAULT',
    "score" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "EvaluationCriterionLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvaluationCriterionVariant_criterionId_key_key" ON "EvaluationCriterionVariant"("criterionId", "key");
CREATE UNIQUE INDEX "EvaluationCriterionLevel_criterionId_variantKey_score_key" ON "EvaluationCriterionLevel"("criterionId", "variantKey", "score");

ALTER TABLE "EvaluationCriterionVariant" ADD CONSTRAINT "EvaluationCriterionVariant_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationCriterionLevel" ADD CONSTRAINT "EvaluationCriterionLevel_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Header of the standard document (filled in on screen by Admin SDM)
ALTER TABLE "EvaluationSetting" ADD COLUMN "standardDocNumber" TEXT, ADD COLUMN "standardRevision" TEXT, ADD COLUMN "standardEffectiveDate" TEXT;

-- Performance: kualitasKerja
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan menyelesaikan pekerjaan secara tuntas, akurat, tepat waktu, dan sesuai standar yang ditetapkan. Mencakup tanggung jawab atas hasil pekerjaan, pemeriksaan kualitas secara mandiri, serta upaya mencegah kesalahan dan pekerjaan ulang.$q$ WHERE "key" = 'kualitasKerja';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kualitasKerja_DEFAULT_2', 'ecr_kualitasKerja', 'DEFAULT', 2, $q$Hasil pekerjaan sering tidak memenuhi standar, terdapat kesalahan berulang, atau pekerjaan tidak tuntas. Sangat bergantung pada pemeriksaan dan perbaikan dari orang lain.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kualitasKerja_DEFAULT_4', 'ecr_kualitasKerja', 'DEFAULT', 4, $q$Mampu menghasilkan pekerjaan sesuai standar dalam kondisi tertentu, tetapi belum konsisten dalam kualitas, ketuntasan, atau ketepatan waktu. Masih membutuhkan pengawasan dan koreksi.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kualitasKerja_DEFAULT_6', 'ecr_kualitasKerja', 'DEFAULT', 6, $q$Secara konsisten menghasilkan pekerjaan sesuai standar dan waktu yang disepakati. Melakukan pemeriksaan mandiri, menyelesaikan tanggung jawabnya, serta segera menyampaikan potensi keterlambatan atau ketidaksesuaian.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kualitasKerja_DEFAULT_8', 'ecr_kualitasKerja', 'DEFAULT', 8, $q$Menghasilkan pekerjaan yang konsisten dan dapat diandalkan, sekaligus secara aktif mengidentifikasi potensi kesalahan dan melakukan perbaikan yang terbukti meningkatkan kualitas, ketepatan, atau efisiensi pekerjaan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kualitasKerja_DEFAULT_10', 'ecr_kualitasKerja', 'DEFAULT', 10, $q$Secara konsisten menghasilkan pekerjaan yang melampaui standar mutu, ketepatan waktu, dan ketuntasan. Menciptakan cara pencegahan kesalahan atau perbaikan kerja yang terbukti efektif, diterapkan oleh orang lain, dan memberikan peningkatan kualitas atau efisiensi yang berkelanjutan.$q$);

-- Performance: kepemimpinan
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan memimpin diri sendiri dan orang lain melalui kedisiplinan, inisiatif, tanggung jawab, dan keteladanan. Bagi karyawan yang memiliki tanggung jawab memimpin tim, mencakup kemampuan memberikan arahan, mengelola pekerjaan dan kinerja tim.$q$ WHERE "key" = 'kepemimpinan';
INSERT INTO "EvaluationCriterionVariant" ("id", "criterionId", "key", "label", "sortOrder", "appliesToLevels", "appliesToSubordinates") VALUES ('ecv_kepemimpinan_INDIVIDU', 'ecr_kepemimpinan', 'INDIVIDU', $q$Penerapan individu$q$, 0, NULL, false);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_INDIVIDU_2', 'ecr_kepemimpinan', 'INDIVIDU', 2, $q$Tidak mampu mengelola tanggung jawab, kedisiplinan, dan komitmen kerja secara mandiri. Sering menghindari tanggung jawab atau membutuhkan pengawasan terus-menerus.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_INDIVIDU_4', 'ecr_kepemimpinan', 'INDIVIDU', 4, $q$Menunjukkan kedisiplinan dan tanggung jawab, tetapi belum konsisten. Masih membutuhkan pengingat dan arahan untuk mengatur prioritas, menyelesaikan komitmen, atau mengambil inisiatif.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_INDIVIDU_6', 'ecr_kepemimpinan', 'INDIVIDU', 6, $q$Mampu mengelola diri, prioritas, dan komitmen kerja secara mandiri. Menunjukkan kedisiplinan, inisiatif, dan keteladanan serta bertanggung jawab atas hasil dan konsekuensi pekerjaannya.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_INDIVIDU_8', 'ecr_kepemimpinan', 'INDIVIDU', 8, $q$Menjadi teladan, menunjukkan inisiatif yang memberikan dampak positif, serta secara aktif membantu, memotivasi, atau mengembangkan rekan kerja meskipun tidak memiliki kewenangan memimpin secara formal.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_INDIVIDU_10', 'ecr_kepemimpinan', 'INDIVIDU', 10, $q$Secara konsisten menjadi teladan dalam disiplin, komitmen, dan tanggung jawab, termasuk dalam situasi menantang. Inisiatif dan pengaruh positifnya mendorong rekan lain untuk lebih mandiri, berkembang, dan menghasilkan perbaikan nyata yang berkelanjutan bagi tim atau organisasi.$q$);
INSERT INTO "EvaluationCriterionVariant" ("id", "criterionId", "key", "label", "sortOrder", "appliesToLevels", "appliesToSubordinates") VALUES ('ecv_kepemimpinan_BAWAHAN', 'ecr_kepemimpinan', 'BAWAHAN', $q$Penerapan memiliki bawahan$q$, 1, NULL, true);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_BAWAHAN_2', 'ecr_kepemimpinan', 'BAWAHAN', 2, $q$Tidak konsisten menjalankan tanggung jawab dan keteladanan pribadi. Tidak memberikan arahan atau pengelolaan tim yang diperlukan, serta mengabaikan masalah kinerja dan kebutuhan pengembangan anggota tim.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_BAWAHAN_4', 'ecr_kepemimpinan', 'BAWAHAN', 4, $q$Mampu mengelola pekerjaan dan memberikan arahan dasar, tetapi belum konsisten dalam delegasi, monitoring, pemberian feedback, coaching, atau pengembangan anggota tim. Masih membutuhkan arahan dalam menjalankan tanggung jawab kepemimpinan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_BAWAHAN_6', 'ecr_kepemimpinan', 'BAWAHAN', 6, $q$Menunjukkan kedisiplinan dan keteladanan pribadi, mampu menetapkan ekspektasi, membagi tanggung jawab, mendelegasikan pekerjaan, memantau kinerja, memberikan feedback, serta melakukan coaching atau mentoring sesuai kebutuhan anggota tim.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_BAWAHAN_8', 'ecr_kepemimpinan', 'BAWAHAN', 8, $q$Secara efektif membangun tim yang mandiri, bertanggung jawab, dan berkinerja baik. Aktif mengembangkan kemampuan anggota tim melalui coaching, mentoring, dan delegasi yang tepat, serta menciptakan peningkatan nyata dalam efektivitas, kemampuan, dan kinerja tim.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kepemimpinan_BAWAHAN_10', 'ecr_kepemimpinan', 'BAWAHAN', 10, $q$Secara konsisten membangun tim yang mandiri, berani mengambil tanggung jawab, dan mampu menjaga kinerja tanpa ketergantungan berlebihan pada atasan. Secara terencana menumbuhkan kemampuan dan calon pemimpin melalui delegasi, coaching, mentoring, dan evaluasi, dengan peningkatan kinerja tim yang terukur dan berkelanjutan.$q$);

-- Performance: keahlianTeknis
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan memahami dan menerapkan pengetahuan, metode, standar, serta alat atau teknologi yang diperlukan dalam pekerjaan. Mencakup kemampuan bekerja mandiri, mengatasi kendala teknis, dan menyesuaikan keterampilan dengan perubahan kebutuhan pekerjaan.$q$ WHERE "key" = 'keahlianTeknis';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_keahlianTeknis_DEFAULT_2', 'ecr_keahlianTeknis', 'DEFAULT', 2, $q$Belum menguasai pengetahuan atau keterampilan teknis dasar yang dibutuhkan untuk menjalankan pekerjaannya sesuai standar. Sangat bergantung pada bantuan orang lain.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_keahlianTeknis_DEFAULT_4', 'ecr_keahlianTeknis', 'DEFAULT', 4, $q$Memahami sebagian besar pekerjaan rutin, tetapi penerapannya belum konsisten. Masih membutuhkan bantuan saat menghadapi variasi pekerjaan atau kendala teknis.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_keahlianTeknis_DEFAULT_6', 'ecr_keahlianTeknis', 'DEFAULT', 6, $q$Menguasai pengetahuan, standar, metode, dan alat kerja yang dibutuhkan. Mampu menjalankan pekerjaan secara mandiri, menangani kendala teknis rutin, serta mempelajari perubahan metode atau teknologi yang relevan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_keahlianTeknis_DEFAULT_8', 'ecr_keahlianTeknis', 'DEFAULT', 8, $q$Mampu menangani persoalan teknis yang lebih kompleks dalam lingkup pekerjaannya, mengadaptasi pengetahuan atau teknologi baru secara efektif, serta memberikan kontribusi nyata melalui perbaikan metode kerja atau berbagi keahlian dengan orang lain.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_keahlianTeknis_DEFAULT_10', 'ecr_keahlianTeknis', 'DEFAULT', 10, $q$Menjadi rujukan dalam penyelesaian masalah teknis kritis atau sangat kompleks. Mengembangkan, menguji, dan membakukan metode kerja yang terbukti meningkatkan kualitas, produktivitas, atau keselamatan, serta mentransfer keahlian sehingga perbaikan dapat diterapkan secara konsisten oleh orang lain.$q$);

-- Performance: komunikasi
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan menyampaikan dan menerima informasi secara jelas, terbuka, dan konstruktif, serta membangun kerja sama yang efektif untuk mencapai tujuan bersama. Mencakup keterbukaan informasi, kemampuan mendengarkan dan menghargai perbedaan pendapat, keberanian memberikan masukan, saling mendukung, serta kesadaran bahwa keberhasilan pekerjaan saling bergantung dengan pihak lain.$q$ WHERE "key" = 'komunikasi';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_komunikasi_DEFAULT_2', 'ecr_komunikasi', 'DEFAULT', 2, $q$Komunikasi sering tidak jelas atau mengabaikan informasi penting. Tidak menunjukkan kemauan bekerja sama, menghambat koordinasi, atau membiarkan konflik mengganggu penyelesaian pekerjaan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_komunikasi_DEFAULT_4', 'ecr_komunikasi', 'DEFAULT', 4, $q$Mampu menyampaikan informasi dan bekerja sama dalam tugas rutin, tetapi belum konsisten dalam keterbukaan, mendengarkan, koordinasi, atau tindak lanjut. Cenderung pasif atau hanya berfokus pada pekerjaan sendiri dan masih membutuhkan dorongan untuk menyelesaikan perbedaan pendapat.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_komunikasi_DEFAULT_6', 'ecr_komunikasi', 'DEFAULT', 6, $q$Berkomunikasi secara jelas dan tepat waktu, berbagi informasi yang relevan, aktif mendengarkan, dan bekerja sama dengan pihak terkait. Terbuka terhadap masukan, berani menyampaikan perbedaan pandangan secara konstruktif, serta bertanggung jawab terhadap komitmen bersama.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_komunikasi_DEFAULT_8', 'ecr_komunikasi', 'DEFAULT', 8, $q$Secara proaktif membangun kolaborasi, mengantisipasi kebutuhan informasi dan dampak terhadap pihak lain, serta membantu menyelesaikan perbedaan pandangan secara konstruktif. Mendorong transparansi, saling mendukung, dan perbaikan bersama yang menghasilkan dampak nyata pada efektivitas kerja kolektif.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_komunikasi_DEFAULT_10', 'ecr_komunikasi', 'DEFAULT', 10, $q$Secara konsisten menyatukan pihak-pihak dengan kebutuhan atau pandangan berbeda untuk menuntaskan hambatan kerja lintas fungsi. Membangun kepercayaan, keterbukaan, dan akuntabilitas bersama; mendorong praktik kolaborasi yang diikuti orang lain dan menghasilkan peningkatan efektivitas kerja yang berkelanjutan.$q$);

-- Performance: pemecahanMasalah
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan mengidentifikasi dan menganalisis permasalahan, memahami akar penyebab berdasarkan fakta yang relevan, serta merumuskan dan menerapkan solusi yang efektif. Mencakup evaluasi hasil dan upaya mencegah masalah yang sama terulang.$q$ WHERE "key" = 'pemecahanMasalah';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pemecahanMasalah_DEFAULT_2', 'ecr_pemecahanMasalah', 'DEFAULT', 2, $q$Kesulitan mengenali atau memahami masalah yang berkaitan dengan pekerjaannya. Cenderung mengabaikan masalah, menyalahkan faktor lain, atau membiarkan masalah berulang tanpa tindakan yang sesuai.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pemecahanMasalah_DEFAULT_4', 'ecr_pemecahanMasalah', 'DEFAULT', 4, $q$Mampu mengenali masalah dan melakukan tindakan sementara, tetapi masih kesulitan menganalisis penyebab dan menentukan solusi yang efektif tanpa bantuan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pemecahanMasalah_DEFAULT_6', 'ecr_pemecahanMasalah', 'DEFAULT', 6, $q$Mampu mengidentifikasi masalah, menganalisis penyebab berdasarkan informasi yang tersedia, menerapkan solusi yang sesuai, dan memeriksa apakah masalah telah terselesaikan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pemecahanMasalah_DEFAULT_8', 'ecr_pemecahanMasalah', 'DEFAULT', 8, $q$Mampu menganalisis masalah yang lebih kompleks atau berulang, menemukan penyebab mendasar, serta mengembangkan solusi atau perbaikan yang terbukti efektif untuk mencegah masalah serupa.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pemecahanMasalah_DEFAULT_10', 'ecr_pemecahanMasalah', 'DEFAULT', 10, $q$Mampu mengurai masalah kompleks atau berulang secara sistematis berdasarkan data dan melibatkan pihak terkait bila diperlukan. Tidak hanya menyelesaikan akar masalah, tetapi juga membakukan tindakan pencegahan dan membagikan pembelajaran sehingga masalah serupa tidak terulang dan solusi dapat diterapkan pada area lain.$q$);

-- Performance: pengambilanKeputusan
UPDATE "EvaluationCriterion" SET "definition" = $q$Kemampuan menentukan dan menjalankan tindakan secara tepat waktu berdasarkan informasi, pertimbangan risiko, prioritas, dan dampak terhadap pihak terkait.$q$ WHERE "key" = 'pengambilanKeputusan';
INSERT INTO "EvaluationCriterionVariant" ("id", "criterionId", "key", "label", "sortOrder", "appliesToLevels", "appliesToSubordinates") VALUES ('ecv_pengambilanKeputusan_LEVEL_RENDAH', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', $q$Harian Lepas, level 1A, 1B, 1C, 2A, 2B$q$, 0, $q$HL,1A,1B,1C,2A,2B$q$, NULL);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_RENDAH_2', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', 2, $q$Sering menghindari atau menunda keputusan sederhana yang menjadi tanggung jawabnya, atau mengambil tindakan tanpa mempertimbangkan aturan, informasi penting, dan konsekuensi yang jelas.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_RENDAH_4', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', 4, $q$Dapat menentukan tindakan untuk situasi rutin, tetapi masih sering ragu, menunda, atau bergantung pada keputusan atasan meskipun berada dalam kewenangannya.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_RENDAH_6', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', 6, $q$Mampu mengambil keputusan secara mandiri dan tepat waktu dalam lingkup kewenangannya. Mempertimbangkan informasi dan risiko yang relevan, melibatkan pihak terkait bila diperlukan, serta bertanggung jawab atas tindak lanjutnya.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_RENDAH_8', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', 8, $q$Secara proaktif mengantisipasi konsekuensi, menentukan tindakan yang efektif dalam situasi tidak rutin atau lebih kompleks di lingkup pekerjaannya, serta memberikan kontribusi nyata dalam meningkatkan kualitas atau efektivitas pengambilan keputusan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_RENDAH_10', 'ecr_pengambilanKeputusan', 'LEVEL_RENDAH', 10, $q$Secara konsisten mengambil keputusan tepat waktu dalam situasi baru atau tidak pasti sesuai kewenangannya, dengan mempertimbangkan alternatif, risiko, dan dampaknya terhadap pihak terkait. Mengubah pembelajaran dari keputusan tersebut menjadi panduan atau praktik yang membantu rekan lain mengambil keputusan lebih baik secara mandiri.$q$);
INSERT INTO "EvaluationCriterionVariant" ("id", "criterionId", "key", "label", "sortOrder", "appliesToLevels", "appliesToSubordinates") VALUES ('ecv_pengambilanKeputusan_LEVEL_TINGGI', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', $q$Level 2C, 3A, 3B, 4A, 5A (Director)$q$, 1, $q$2C,3A,3B,4A,5A,DIRECTOR$q$, NULL);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_TINGGI_2', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', 2, $q$Menghindari atau menunda keputusan yang menjadi tanggung jawabnya. Sering mengalihkan keputusan kepada atasan tanpa alasan yang jelas atau mengambil keputusan tanpa mempertimbangkan dampak, risiko, dan pihak terkait.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_TINGGI_4', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', 4, $q$Mampu mengambil keputusan rutin, tetapi belum konsisten dalam mempertimbangkan risiko, prioritas, alternatif, dan dampak terhadap pihak terkait. Masih terlalu bergantung pada arahan atau eskalasi yang sebenarnya tidak diperlukan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_TINGGI_6', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', 6, $q$Mengambil keputusan secara mandiri, tepat waktu, dan bertanggung jawab sesuai kewenangan. Mempertimbangkan informasi, risiko, prioritas, serta dampak terhadap pihak terkait, melakukan koordinasi yang diperlukan, dan memastikan tindak lanjut keputusan terlaksana.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_TINGGI_8', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', 8, $q$Mampu mengambil keputusan efektif dalam situasi kompleks atau melibatkan berbagai kepentingan, termasuk lintas fungsi bila relevan dengan kewenangannya. Mengantisipasi konsekuensi, menyeimbangkan kebutuhan organisasi, serta mendorong penyelesaian keputusan pada tingkat kewenangan yang tepat tanpa eskalasi yang tidak diperlukan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_pengambilanKeputusan_LEVEL_TINGGI_10', 'ecr_pengambilanKeputusan', 'LEVEL_TINGGI', 10, $q$Secara konsisten mengambil keputusan yang tepat dalam situasi kompleks, tidak pasti, atau lintas fungsi dengan mempertimbangkan prioritas, alternatif, risiko, dan konsekuensi jangka panjang. Memperjelas batas kewenangan, membangun mekanisme tindak lanjut, dan meningkatkan kecepatan serta kualitas keputusan tim tanpa eskalasi yang tidak diperlukan.$q$);

-- Tata Nilai: melayani
UPDATE "EvaluationCriterion" SET "definition" = $q$Stakeholder focus$q$ WHERE "key" = 'melayani';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_melayani_DEFAULT_0', 'ecr_melayani', 'DEFAULT', 0, $q$Menyalahkan orang lain atas kesalahan yang terjadi
Bekerja sesuai perintah tanpa memikirkan benar/salah
Bersikap baik hanya pada pimpinan (memandang ke atas tidak memandang ke bawah)$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_melayani_DEFAULT_25', 'ecr_melayani', 'DEFAULT', 25, $q$Bekerja seperti robot / mesin, menganggap pekerjaan hanya sekedar pekerjaan, tidak sepenuh hati mencurahkan perhatian dan pikiran untuk pekerjaan.
Bekerja secukupnya tanpa usaha penuh dan tidak ada sikap peduli pada pekerjaan yang sedang dilakukan
Memperhatikan hasil sendiri tanpa memperhatikan sekitar (rekan kerja, lingkungan kerja dan perusahaan)$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_melayani_DEFAULT_50', 'ecr_melayani', 'DEFAULT', 50, $q$Melayani semua pemangku kepentingan tanpa memilih-milih dan dilakukan dengan usaha penuh
Selalu bersikap peduli saat menghadapi siapapun
Berfokus memikirkan solusi ketika menghadapi masalah dan menghindari terjadinya kesalahan yang sama$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_melayani_DEFAULT_75', 'ecr_melayani', 'DEFAULT', 75, $q$Melakukan pekerjaan dengan sepenuhnya sadar bahwa pekerjaan adalah bentuk melayani orang lain, dengan kehendak untuk melakukan hal yang benar sesuai dengan hati nurani
Selalu menunjukkan sikap empati dan berusaha memahami sudut pandang orang lain$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_melayani_DEFAULT_100', 'ecr_melayani', 'DEFAULT', 100, $q$Menjadi teladan bagi banyak orang untuk melayani
Selalu berusaha membangun budaya melayani dengan sepenuh hati di perusahaan
Memiliki inisiatif untuk antisipasi kemungkinan masalah yang akan dihadapi oleh orang lain$q$);

-- Tata Nilai: jujur
UPDATE "EvaluationCriterion" SET "definition" = $q$Honest$q$ WHERE "key" = 'jujur';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_jujur_DEFAULT_0', 'ecr_jujur', 'DEFAULT', 0, $q$Belum dapat menunjukkan kejujuran dalam pekerjaan (laporan kerja, mencuri, dll)
Sengaja menutupi kesalahan untuk melindungi diri sendiri dan orang lain$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_jujur_DEFAULT_25', 'ecr_jujur', 'DEFAULT', 25, $q$Jujur dan dapat dipercaya
Tidak menyembunyikan / menutupi kesalahan orang lain.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_jujur_DEFAULT_50', 'ecr_jujur', 'DEFAULT', 50, $q$Menjunjung tinggi nilai-nilai perusahaan dan etika. Transparan dalam berkomunikasi
Memilih untuk berkata dan bertindak jujur setiap saat, termasuk ketika tidak ada pengawasan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_jujur_DEFAULT_75', 'ecr_jujur', 'DEFAULT', 75, $q$Dapat membangun kepercayaan dari berbagai pihak.
Berani bertanggung jawab terhadap tindakan yang dilakukan$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_jujur_DEFAULT_100', 'ecr_jujur', 'DEFAULT', 100, $q$Menjadi teladan bagi banyak orang untuk standar penerapan etika dan penyelesaian pekerjaan
Ikut membangun budaya kejujuran di perusahaan$q$);

-- Tata Nilai: rencana
UPDATE "EvaluationCriterion" SET "definition" = $q$Planning$q$ WHERE "key" = 'rencana';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_rencana_DEFAULT_0', 'ecr_rencana', 'DEFAULT', 0, $q$Bekerja melenceng dari rencana kerja / Standar Operasional Prosedur (SOP) yang sudah disetujui dan ditetapkan.
Diam saja / tidak bertanya ketika tidak mengerti.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_rencana_DEFAULT_25', 'ecr_rencana', 'DEFAULT', 25, $q$Melakukan pekerjaan tanpa memikirkan atau merencanakan kebutuhan pendukung.
Bekerja sesuai dengan rencana kerja / Standar Operasional Prosedur (SOP) yang sudah disetujui dan ditetapkan.
Bertanya jika tidak mengerti.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_rencana_DEFAULT_50', 'ecr_rencana', 'DEFAULT', 50, $q$Bekerja sesuai dengan rencana kerja / SOP yang diberikan, merencanakan kebutuhan pendukung pekerjaan (5W+1H, Apa, Siapa, Kapan, Mengapa, Dimana+Bagaimana)
Bekerja sesuai dengan rencana kerja / SOP yang sudah disetujui dan ditetapkan dan membuat laporan rutin akan hasil pekerjaan.
Melapor pada pihak terkait sebelum melakukan perubahan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_rencana_DEFAULT_75', 'ecr_rencana', 'DEFAULT', 75, $q$Berperan aktif dalam proses perencanaan dan dapat memberikan masukan untuk pernaikan rencana / proses / sistem kerja agar dapat berjalan menjadi lebih baik.
Segera menghentikan pekerjaan jika dirasa ada sebuah penyimpangan / keanehan dalam proses yang sedang berjalan, walaupun sesuai dengan rencana kerja /$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_rencana_DEFAULT_100', 'ecr_rencana', 'DEFAULT', 100, $q$Berperan aktif dalam mengajak / membangun budaya di perusahaan dan mengajarkan orang lain dalam penyusunan perencanaan
Selalu menyiapkan rencana untuk antisipasi keadaan$q$);

-- Tata Nilai: kemajuan
UPDATE "EvaluationCriterion" SET "definition" = $q$Continuous improvement$q$ WHERE "key" = 'kemajuan';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kemajuan_DEFAULT_0', 'ecr_kemajuan', 'DEFAULT', 0, $q$Merasa sudah cukup dan tidak ada keinginan untuk menjadi lebih baik
Sering menolak melakukan / mengikuti perubahan yang dilakukan perusahaan
Sering menolak mengikuti pelatihan / pengembangan diri dan terjebak dalam zona nyaman$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kemajuan_DEFAULT_25', 'ecr_kemajuan', 'DEFAULT', 25, $q$Masih memerlukan bantuan orang lain untuk ide perbaikan berkelanjutan
Mempunyai arah tujuan target perbaikan / pengembangan dalam bekerja dan berusaha untuk mencapainya
Sudah memiliki keinginan untuk berkembang menjadi lebih baik dari kemarin$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kemajuan_DEFAULT_50', 'ecr_kemajuan', 'DEFAULT', 50, $q$Mau terus belajar setiap hari dan memperbaiki diri (karakter dan ketrampilan kerja)
Bersedia memberi dan menerima kritik serta masukan dengan sikap konstruktif dan positif.
Selalu bertanya, “Hal kecil apa yang saya bisa lakukan hari ini untuk saya bisa maju satu langkah?”$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kemajuan_DEFAULT_75', 'ecr_kemajuan', 'DEFAULT', 75, $q$Selain untuk kemajuan diri sendiri, membantu / mendukung orang lain untuk dapat maju dan berkembang
Menjadi yang pertama dalam menyambut setiap tantangan perubahan dan terobosan yang terjadi di perusahaan serta berusaha seutuhnya untuk melakukannya.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_kemajuan_DEFAULT_100', 'ecr_kemajuan', 'DEFAULT', 100, $q$Selalu berusaha melakukan perbaikan berkelanjutan untuk pencapaian strategi perusahaan
Sering mempertanyakan “Hal kecil apa yang bisa saya lakuakan hari ini untuk PERUSAHAAN agar bisa maju satu langkah?”$q$);

-- Tata Nilai: legenda
UPDATE "EvaluationCriterion" SET "definition" = $q$Legacy$q$ WHERE "key" = 'legenda';
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_legenda_DEFAULT_0', 'ecr_legenda', 'DEFAULT', 0, $q$Individualis, bukan pemain tim, bersikap egois dan mengutamakan kepentingan diri sendiri
Mempunyai kepentingan lain yang dapat merugikan perusahaan
Melalaikan pekerjaan karena kepentingan pribadi$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_legenda_DEFAULT_25', 'ecr_legenda', 'DEFAULT', 25, $q$Bekerjasama dengan rekan lainya ketika ditempatkan dalam tim
Mengetahui arah dan tujuan dari perusahaan, dan ingin turut serta berpartisipasi dalam proses menuju tujuan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_legenda_DEFAULT_50', 'ecr_legenda', 'DEFAULT', 50, $q$Dapat mengandalkan dan percaya pada rekan kerja antar divisi / bagian
Mengutamakan kepentingan perusahaan / bersama dan tidak bersikap egois
Mengerti arah tujuan dari perusahaan dan aktif turut serta berpartisipasi dalam proses menuju tujuan.$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_legenda_DEFAULT_75', 'ecr_legenda', 'DEFAULT', 75, $q$Memiliki keyakinan pada pimpinan perusahaan
Memiliki kesabaran akan hasil
Memiliki kepercayaan pada proses$q$);
INSERT INTO "EvaluationCriterionLevel" ("id", "criterionId", "variantKey", "score", "description") VALUES ('ecl_legenda_DEFAULT_100', 'ecr_legenda', 'DEFAULT', 100, $q$Dapat menjadi inspirasi untuk membuat legenda
Selalu memberikan motivasi ke orang lain untuk sejalan dengan tata nilai perusahaan
Turut serta proaktif dalam proses menjadikan perusahaan ini menjadi LEGENDA DI INDONESIA.$q$);
