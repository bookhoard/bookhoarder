import { ALL_METADATA_PROVIDER_IDS, type MetadataProviderId } from "@/lib/metadata/types";

export type SmtpEncryption = "none" | "starttls" | "ssl";

export interface SmtpSettings {
  host?: string;
  port?: number;
  /** none = plaintext, starttls = upgrade via STARTTLS (typically port 587), ssl = implicit TLS (typically port 465) */
  encryption?: SmtpEncryption;
  user?: string;
  pass?: string;
  fromAddress?: string;
}

export interface AppSettings {
  /** how many candidates the Fetch Metadata drawer requests per provider */
  metadataCandidateLimit: number;
  /** which metadata providers the Fetch Metadata drawer searches */
  metadataProviders: MetadataProviderId[];
  trendingEnabled: boolean;
  /** how many books each BookGrid (Library, Trending, shelves) shows per page */
  booksPerPage: number;
  /** how many results the ⌘K search dialog shows before "keep typing to narrow it down" */
  searchResultLimit: number;
  /** largest .epub file accepted by uploads, in MB */
  uploadMaxSizeMb: number;
  smtp: SmtpSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  metadataCandidateLimit: 10,
  metadataProviders: [...ALL_METADATA_PROVIDER_IDS],
  trendingEnabled: true,
  booksPerPage: 50,
  searchResultLimit: 10,
  uploadMaxSizeMb: 25,
  smtp: {},
};

/** Settings the client is allowed to see — SMTP password stripped. */
export type PublicAppSettings = Omit<AppSettings, "smtp"> & {
  smtp: Omit<SmtpSettings, "pass"> & { hasPassword: boolean };
};

export function toPublicSettings(settings: AppSettings): PublicAppSettings {
  const { pass, ...smtpRest } = settings.smtp;
  return {
    ...settings,
    smtp: { ...smtpRest, hasPassword: !!pass },
  };
}
