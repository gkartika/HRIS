"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAssets } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createAssetLocation(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const locationName = (formData.get("locationName") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!locationName) return "Nama lokasi wajib diisi.";

  const existing = await prisma.assetLocation.findUnique({ where: { locationName } });
  if (existing) return `"${locationName}" sudah ada dalam daftar.`;

  const location = await prisma.assetLocation.create({ data: { locationName, description } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AssetLocation",
    recordId: location.id,
    reason: `Added asset location "${locationName}"`,
  });

  revalidatePath("/assets/locations");
  redirect("/assets/locations");
}

export async function toggleAssetLocation(
  locationId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const activeFlag = formData.get("activeFlag") === "on";
  await prisma.assetLocation.update({ where: { id: locationId }, data: { activeFlag } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AssetLocation",
    recordId: locationId,
    reason: `Set active=${activeFlag}`,
  });

  revalidatePath("/assets/locations");
}
