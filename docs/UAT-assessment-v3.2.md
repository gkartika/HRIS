# UAT checklist: Tes Situasi Kerja V3.2 (build branch)

Before: the migration `20261021120000_recruitment_assessment_v32` is applied (the owner agrees first, it is live for production at once). Use a disposable applicant (name starting ZZT) and delete it afterwards.

## A. Rubric (Admin Rekrutmen)
1. Rekrutmen > Rubrik Tes Situasi Kerja shows "Data tes belum dimuat". Click "Muat paket V3.2 sebagai draf" > rubric V3.2-R1 appears as **Draf**.
2. Open it: 20 questions, 4 choices each, a dimension per question, an observation and a value per choice. The green line says all values equal the V3.2 matrix.
3. Change one observation and one value, Simpan. The history shows "Diubah" with what changed. Change it back.
4. Ajukan ke HR Manager. Status becomes "Menunggu persetujuan"; no field can be edited any more.

## B. Approval (HR Manager)
5. Sign in as the HR Manager: the rubric is visible, with Setujui and Kembalikan. Admin Rekrutmen (without the HR Manager Position) sees neither.
6. Kembalikan with an empty reason is refused; with a reason the rubric is a Draf again and shows the reason. Submit again.
7. Setujui: status "Disetujui (belum aktif)", approver and time are shown, values are locked. A candidate cannot start yet.
8. Aktifkan (Admin Rekrutmen or HR Manager): status Aktif.
9. Buat revisi: a new draft V3.2-R2 appears with the same values; R1 is unchanged. Only one revision can be open.

## C. Applicant
10. Apply to an external vacancy, finish Cultural Fit: the test page now shows the Tes Situasi Kerja card. Before Cultural Fit is finished it does not show.
11. Open it: instructions, then one situation per screen, no titles/dimensions/scores. Choose, go next, close the page, reopen: answers and position are kept.
12. The last screen cannot be sent until all 20 are answered. Send: a thank-you text. Open the link again or click send twice: no second score.
13. The applicant's status did not change.

## D. HR result
14. Rubrik > Lihat hasil: the applicant is listed with score and status; filter by status and search a name work.
15. Open: status, score, "Asesmen V3.2 · rubrik V3.2-R1", times, material concerns on top (even with a total above -6), all 20 entries expandable with the original question and chosen answer, and the trace line.
16. An in-progress applicant shows "n dari 20 soal terjawab", no score.
17. Archive R1 / approve R2 afterwards: the applicant's score and observations do not change.

## E. Access
18. Admin SDM, Admin GA, a plain employee: the pages show "Anda tidak memiliki akses." and the page source contains no result data.

Cleanup: delete the ZZT applicant's rows; leave the imported master data.

## F. Internal employee
19. Apply to an internal vacancy as a test employee (ZZT), sign in as that employee, finish Cultural Fit on Lowongan Internal > Tes: the Tes Situasi Kerja card appears below. Take it as in C.
20. In the results list and detail the applicant shows "Internal" with the employee's name and number.
21. Another signed-in employee opening `/internal-jobs/asesmen/<that id>` gets "Anda tidak memiliki akses.".
