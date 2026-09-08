import { mutateJson, readJson } from "@/lib/store";
import type { MetadataProviderId } from "@/lib/metadata/types";
import { DEFAULT_SETTINGS, type AppSettings, type SmtpSettings } from "./types";

const KEY = "settings.json";

export async function getSettings(): Promise<AppSettings> {
  const stored = await readJson<Partial<AppSettings>>(KEY);
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    smtp: { ...DEFAULT_SETTINGS.smtp, ...stored.smtp },
  };
}

export interface SettingsPatch {
  metadataCandidateLimit?: number;
  metadataProviders?: MetadataProviderId[];
  trendingEnabled?: boolean;
  booksPerPage?: number;
  searchResultLimit?: number;
  uploadMaxSizeMb?: number;
  smtp?: Partial<SmtpSettings>;
}

export async function updateSettings(patch: SettingsPatch): Promise<AppSettings> {
  return mutateJson<AppSettings>(KEY, (current) => {
    const base = current
      ? { ...DEFAULT_SETTINGS, ...current, smtp: { ...DEFAULT_SETTINGS.smtp, ...current.smtp } }
      : DEFAULT_SETTINGS;
    return {
      ...base,
      ...patch,
      smtp: { ...base.smtp, ...patch.smtp },
    };
  });
}
