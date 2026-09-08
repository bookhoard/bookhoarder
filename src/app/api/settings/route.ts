import { NextResponse } from "next/server";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/settings/store";
import { toPublicSettings } from "@/lib/settings/types";
import { getActiveProfile } from "@/lib/profiles/store";
import { ALL_METADATA_PROVIDER_IDS, type MetadataProviderId } from "@/lib/metadata/types";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings: toPublicSettings(settings) });
}

export async function PATCH(request: Request) {
  const active = await getActiveProfile();
  if (active.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can change these settings" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SettingsPatch & {
    smtp?: SettingsPatch["smtp"] & { clearPassword?: boolean };
  };

  const patch: SettingsPatch = {};

  if (typeof body.metadataCandidateLimit === "number") {
    const n = Math.round(body.metadataCandidateLimit);
    if (n < 1 || n > 20) {
      return NextResponse.json(
        { error: "metadataCandidateLimit must be between 1 and 20" },
        { status: 400 }
      );
    }
    patch.metadataCandidateLimit = n;
  }

  if (Array.isArray(body.metadataProviders)) {
    const valid = new Set<string>(ALL_METADATA_PROVIDER_IDS);
    patch.metadataProviders = body.metadataProviders.filter(
      (id): id is MetadataProviderId => typeof id === "string" && valid.has(id)
    );
  }

  if (typeof body.trendingEnabled === "boolean") {
    patch.trendingEnabled = body.trendingEnabled;
  }

  if (typeof body.booksPerPage === "number") {
    const n = Math.round(body.booksPerPage);
    if (n < 10 || n > 500) {
      return NextResponse.json(
        { error: "booksPerPage must be between 10 and 500" },
        { status: 400 }
      );
    }
    patch.booksPerPage = n;
  }

  if (typeof body.searchResultLimit === "number") {
    const n = Math.round(body.searchResultLimit);
    if (n < 1 || n > 100) {
      return NextResponse.json(
        { error: "searchResultLimit must be between 1 and 100" },
        { status: 400 }
      );
    }
    patch.searchResultLimit = n;
  }

  if (typeof body.uploadMaxSizeMb === "number") {
    const n = Math.round(body.uploadMaxSizeMb);
    if (n < 1 || n > 500) {
      return NextResponse.json(
        { error: "uploadMaxSizeMb must be between 1 and 500" },
        { status: 400 }
      );
    }
    patch.uploadMaxSizeMb = n;
  }

  if (body.smtp) {
    const { clearPassword, pass, ...rest } = body.smtp;
    patch.smtp = { ...rest };
    if (clearPassword) patch.smtp.pass = undefined;
    else if (typeof pass === "string" && pass.length > 0) patch.smtp.pass = pass;
  }

  const settings = await updateSettings(patch);
  return NextResponse.json({ settings: toPublicSettings(settings) });
}
