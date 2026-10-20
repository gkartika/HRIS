import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { canManageRecruitment } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { TEMPLATE_PLACEHOLDERS, TEST_FORM_LABEL } from "@/lib/recruitment-candidates";
import { getRecruitmentSettings } from "@/lib/recruitment-service";
import {
  deleteAspectAction,
  deleteTestTypeAction,
  saveAspectAction,
  saveRecruitmentSettingsAction,
  saveTestTypeAction,
} from "./actions";
import { ActionForm, ConfirmAction, JobTestToggle, TemplatePreview } from "./settings-forms";

const TABS = [
  { key: "tes", label: "Katalog tes" },
  { key: "jabatan", label: "Tes per jabatan" },
  { key: "interview", label: "Interview" },
  { key: "pesan", label: "Pesan dan data" },
] as const;

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const lab = "mb-1 block text-xs text-slate-500";

export default async function RecruitmentSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return <AccessDenied />;
  const { tab: tabRaw, q } = await searchParams;
  const tab = TABS.find((t) => t.key === tabRaw)?.key ?? "tes";

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Pelamar", href: "/recruitment/applicants" }, { label: "Pengaturan Rekrutmen" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">Pengaturan Rekrutmen</h1>
        <p className="mt-1 text-sm text-slate-500">Semuanya diatur di sini, tanpa perlu developer: jenis tes dan soalnya, tes tiap jabatan, aspek penilaian interview, dan pesan undangan.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/recruitment/settings?tab=${t.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "tes" && <CatalogTab />}
      {tab === "jabatan" && <JobTestsTab q={q?.trim() ?? ""} />}
      {tab === "interview" && <InterviewTab />}
      {tab === "pesan" && <MessagesTab />}
    </div>
  );
}

async function CatalogTab() {
  const types = await prisma.recruitmentTestType.findMany({
    orderBy: [{ isGate: "desc" }, { sortOrder: "asc" }],
    include: { _count: { select: { questions: { where: { active: true } }, candidateTests: true, jobTests: true } } },
  });
  return (
    <div className="space-y-4">
      {types.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-slate-900">
                {t.name} {t.isGate && <StatusChip tone="bg-indigo-50 text-indigo-700">Wajib semua posisi, dikerjakan pertama</StatusChip>}{" "}
                {!t.active && <StatusChip tone="bg-slate-100 text-slate-500">Nonaktif</StatusChip>}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {TEST_FORM_LABEL[t.form]} · {t.form === "ESSAY" ? "dinilai reviewer" : `lulus ${t.passScore}`} · {t.timeLimitMinutes} menit · {t._count.questions} soal aktif
                {!t.isGate && ` · dipakai ${t._count.jobTests} jabatan`}
              </p>
              {t.description && <p className="mt-1 text-xs text-slate-400">{t.description}</p>}
            </div>
            <Link href={`/recruitment/settings/tests/${t.id}`} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">
              Kelola soal
            </Link>
          </div>
          <details className="mt-3 rounded-lg border border-slate-100 p-3">
            <summary className="cursor-pointer text-xs font-medium text-indigo-600">Ubah pengaturan tes ini</summary>
            <div className="mt-3">
              <ActionForm action={saveTestTypeAction.bind(null, t.id)} submitLabel="Simpan">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className={lab} htmlFor={`n-${t.id}`}>Nama</label>
                    <input id={`n-${t.id}`} name="name" defaultValue={t.name} required className={field} />
                  </div>
                  <div>
                    <label className={lab} htmlFor={`p-${t.id}`}>Nilai lulus (%){t.form === "ESSAY" ? " (tidak dipakai)" : ""}</label>
                    <input id={`p-${t.id}`} name="passScore" type="number" min={1} max={100} defaultValue={t.passScore} className={field} />
                  </div>
                  <div>
                    <label className={lab} htmlFor={`m-${t.id}`}>Waktu (menit)</label>
                    <input id={`m-${t.id}`} name="timeLimitMinutes" type="number" min={1} max={240} defaultValue={t.timeLimitMinutes} className={field} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-3">
                    <label className={lab} htmlFor={`d-${t.id}`}>Keterangan</label>
                    <input id={`d-${t.id}`} name="description" defaultValue={t.description ?? ""} className={field} />
                  </div>
                  <div>
                    <label className={lab} htmlFor={`o-${t.id}`}>Urutan</label>
                    <input id={`o-${t.id}`} name="sortOrder" type="number" defaultValue={t.sortOrder} className={field} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={t.active} />
                  Aktif (tes nonaktif tidak diberikan ke pelamar baru)
                </label>
              </ActionForm>
              {!t.isGate && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ConfirmAction label="Hapus tes ini" confirmLabel="Ya, hapus tes dan soalnya" action={deleteTestTypeAction.bind(null, t.id)} />
                  <p className="mt-1 text-[11px] text-slate-400">Tes yang sudah pernah dikerjakan pelamar tidak bisa dihapus, nonaktifkan saja.</p>
                </div>
              )}
            </div>
          </details>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Tambah jenis tes</h2>
        <p className="mt-0.5 text-xs text-slate-500">Setelah dibuat, tambahkan soalnya lewat Kelola soal, lalu pilih jabatan yang memakainya di tab Tes per jabatan.</p>
        <div className="mt-3">
          <ActionForm action={saveTestTypeAction.bind(null, null)} submitLabel="Tambah tes" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={lab} htmlFor="new-name">Nama tes</label>
                <input id="new-name" name="name" required placeholder="mis. Tes Bahasa Inggris" className={field} />
              </div>
              <div>
                <label className={lab} htmlFor="new-form">Bentuk soal</label>
                <select id="new-form" name="form" defaultValue="MULTIPLE_CHOICE" className={field}>
                  <option value="MULTIPLE_CHOICE">Pilihan ganda (otomatis)</option>
                  <option value="SCALE">Skala 1-5 (otomatis)</option>
                  <option value="ESSAY">Esai (dinilai reviewer)</option>
                </select>
              </div>
              <div>
                <label className={lab} htmlFor="new-order">Urutan</label>
                <input id="new-order" name="sortOrder" type="number" defaultValue={types.length + 1} className={field} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={lab} htmlFor="new-desc">Keterangan</label>
                <input id="new-desc" name="description" className={field} />
              </div>
              <div>
                <label className={lab} htmlFor="new-pass">Nilai lulus (%)</label>
                <input id="new-pass" name="passScore" type="number" min={1} max={100} defaultValue={70} className={field} />
              </div>
              <div>
                <label className={lab} htmlFor="new-time">Waktu (menit)</label>
                <input id="new-time" name="timeLimitMinutes" type="number" min={1} max={240} defaultValue={15} className={field} />
              </div>
            </div>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

async function JobTestsTab({ q }: { q: string }) {
  const words = q.split(/\s+/).filter(Boolean);
  const [jobs, types, mapped] = await Promise.all([
    prisma.job.findMany({
      where: words.length ? { AND: words.map((w) => ({ jobTitle: { contains: w, mode: "insensitive" as const } })) } : {},
      orderBy: { jobTitle: "asc" },
      select: { id: true, jobTitle: true },
      take: 300,
    }),
    prisma.recruitmentTestType.findMany({ where: { isGate: false, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.recruitmentJobTest.findMany({ select: { jobId: true, testTypeId: true } }),
  ]);
  const has = new Set(mapped.map((m) => `${m.jobId}:${m.testTypeId}`));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Cultural Fit wajib untuk semua jabatan. Centang tes tambahan untuk tiap jabatan; boleh lebih dari satu, boleh tidak ada. Berlaku untuk semua lowongan jabatan itu dan tersimpan langsung.
      </p>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="job-q" className={lab}>Cari jabatan</label>
          <input id="job-q" name="q" defaultValue={q} placeholder="mis. operator" className={field} />
        </div>
        <input type="hidden" name="tab" value="jabatan" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Cari</button>
        {q && <Link href="/recruitment/settings?tab=jabatan" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Reset</Link>}
      </form>
      {types.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">Belum ada tes tambahan aktif. Buat dulu di tab Katalog tes.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Jabatan</th>
                <th className="px-3 py-3 font-medium">Cultural Fit</th>
                {types.map((t) => (
                  <th key={t.id} className="px-3 py-3 font-medium">{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-900">{j.jobTitle}</td>
                  <td className="px-3 py-2.5"><StatusChip tone="bg-emerald-50 text-emerald-700">Wajib</StatusChip></td>
                  {types.map((t) => (
                    <td key={t.id} className="px-3 py-2.5">
                      <JobTestToggle jobId={j.id} testTypeId={t.id} checked={has.has(`${j.id}:${t.id}`)} label={`${j.jobTitle}: ${t.name}`} />
                    </td>
                  ))}
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={types.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada jabatan yang cocok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function InterviewTab() {
  const [aspects, settings] = await Promise.all([
    prisma.recruitmentInterviewAspect.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { scores: true } } } }),
    getRecruitmentSettings(),
  ]);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Aspek penilaian interview</h2>
        <p className="mt-0.5 text-xs text-slate-500">Tiap pewawancara memberi nilai 1 sampai 5 untuk setiap aspek aktif. Mengubah nama aspek tidak mengubah penilaian yang sudah masuk.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {aspects.map((a) => (
            <div key={a.id} className="py-3">
              <ActionForm action={saveAspectAction.bind(null, a.id)} submitLabel="Simpan" className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className={lab} htmlFor={`al-${a.id}`}>Nama aspek</label>
                  <input id={`al-${a.id}`} name="label" defaultValue={a.label} required className={field} />
                </div>
                <div className="w-24">
                  <label className={lab} htmlFor={`ao-${a.id}`}>Urutan</label>
                  <input id={`ao-${a.id}`} name="sortOrder" type="number" defaultValue={a.sortOrder} className={field} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={a.active} />
                  Aktif
                </label>
              </ActionForm>
              <div className="mt-1">
                <ConfirmAction label="Hapus" confirmLabel="Ya, hapus aspek" action={deleteAspectAction.bind(null, a.id)} />
                {a._count.scores > 0 && <span className="ml-2 text-[11px] text-slate-400">Sudah dipakai {a._count.scores} penilaian, nonaktifkan saja.</span>}
              </div>
            </div>
          ))}
          {aspects.length === 0 && <p className="py-3 text-sm text-slate-400">Belum ada aspek. Tanpa aspek, pewawancara hanya mengisi rekomendasi dan catatan.</p>}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ActionForm action={saveAspectAction.bind(null, null)} submitLabel="Tambah aspek" resetOnSuccess className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className={lab} htmlFor="new-aspect">Aspek baru</label>
              <input id="new-aspect" name="label" required placeholder="mis. Kerja sama tim" className={field} />
            </div>
          </ActionForm>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Jumlah pewawancara</h2>
        <div className="mt-3">
          <ActionForm action={saveRecruitmentSettingsAction} submitLabel="Simpan">
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <div>
                <label className={lab} htmlFor="s-def">Jumlah awal di form</label>
                <input id="s-def" name="defaultInterviewers" type="number" min={1} max={8} defaultValue={settings.defaultInterviewers} className={field} />
              </div>
              <div>
                <label className={lab} htmlFor="s-max">Jumlah maksimum</label>
                <input id="s-max" name="maxInterviewers" type="number" min={1} max={8} defaultValue={settings.maxInterviewers} className={field} />
              </div>
            </div>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

async function MessagesTab() {
  const settings = await getRecruitmentSettings();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <ActionForm action={saveRecruitmentSettingsAction} submitLabel="Simpan pengaturan">
        <h2 className="text-sm font-medium text-slate-900">Template pesan undangan interview</h2>
        <p className="text-xs text-slate-500">
          Kata berikut terisi otomatis:{" "}
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <code key={p} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{p}</code>
          ))}
        </p>
        <TemplatePreview initialEmail={settings.invitationEmailTemplate} initialWa={settings.invitationWaTemplate} />

        <h2 className="pt-3 text-sm font-medium text-slate-900">Masa tunggu dan masa simpan data</h2>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div>
            <label className={lab} htmlFor="s-retake">Boleh melamar lagi setelah (hari)</label>
            <input id="s-retake" name="retakeDays" type="number" min={0} max={365} defaultValue={settings.retakeDays} className={field} />
            <p className="mt-1 text-[11px] text-slate-400">Berlaku bagi pelamar yang tidak lolos tes atau ditolak, untuk lowongan apa pun, dihitung dari email yang sama.</p>
          </div>
          <div>
            <label className={lab} htmlFor="s-keep">Data pelamar yang gugur disimpan (hari)</label>
            <input id="s-keep" name="retentionDays" type="number" min={7} max={730} defaultValue={settings.retentionDays} className={field} />
            <p className="mt-1 text-[11px] text-slate-400">Setelah itu bisa dihapus dari halaman Pelamar dengan satu tombol, setelah Anda melihat daftarnya.</p>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
