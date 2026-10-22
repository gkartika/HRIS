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

## G. Time limit and copying
22. The intro says 30 minutes from pressing Mulai. After Mulai a countdown "Sisa waktu 30:00" runs; it turns amber at 5 minutes and red at 1 minute.
23. Reload the page mid-test: the countdown continues from the same moment (it does not restart), and the question you were on comes back.
24. Let the clock reach 0:00 with fewer than 20 answered: the page changes to "Waktu habis". HR sees the applicant as "Belum lengkap" with "n dari 20 soal terjawab", no score. With all 20 answered the attempt is scored normally.
25. Close the browser, come back after 30 minutes: "Waktu habis" (or "Terima kasih" if it was scored); no question is shown.
26. On a question: you cannot select text, copy, cut, drag, right-click, print or Ctrl+C/A/P/S/U; switching to another tab blurs the question; a faint watermark with the applicant's name is behind the text. The questions are not in the page source before Mulai; after Mulai all 20 are on the page in one list, with the clock and the count pinned at the top.

## H. Time limit setting and copy protection on every test
27. Rekrutmen > Rubrik Tes Situasi Kerja shows "Waktu pengerjaan" with the current minutes. Admin Rekrutmen can change it (5 to 240; 3 or 300 is refused with a message); the HR Manager sees the number but no form.
28. After changing it, a NEW applicant's intro and countdown use the new minutes. An applicant who already pressed Mulai keeps the old minutes.
29. A normal test (e.g. Cultural Fit) takes its minutes from Pengaturan Rekrutmen > Katalog tes > "Waktu pengerjaan" for that test.
30. On Cultural Fit and on Tes Situasi Kerja alike: no selecting or copying, no right-click, Ctrl+C/A/P/S/U do nothing, printing shows nothing, switching tab blurs the questions, a faint watermark with the applicant's name is behind the text. In an essay test the answer box is still typeable but pasting into it is blocked.
