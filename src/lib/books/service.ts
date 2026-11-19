import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { getStorage } from "@/lib/storage";
import { mutateJson, readJson } from "@/lib/store";
import { getSettings } from "@/lib/settings/store";
import { listProfiles } from "@/lib/profiles/store";
import type { Profile } from "@/lib/profiles/types";
import {
  applyProfileState,
  deleteProfileBookState,
  getProfileState,
  updateProfileBookState,
  type ProfileBookState,
} from "@/lib/profiles/state";
import { parseEpubMetadata } from "@/lib/epub/metadata";
import { extractEpubCover } from "@/lib/epub/cover";
import { extractAllEpubFiles } from "@/lib/epub/extract";
import { openLibraryUserAgent } from "@/lib/metadata/user-agent";
import { contentTypeFor } from "@/lib/content-type";
import { slugify } from "./slug";
import type { Book, BookRecord } from "./types";

/** A failure the caller should show to the user as-is. `status` is the HTTP
 * status the REST routes answer with; the MCP tools just show the message. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const INDEX_KEY = "index.json";

function metadataKey(id: string): string {
  return `books/${id}/metadata.json`;
}

async function writeRecord(record: BookRecord): Promise<void> {
  await getStorage().put(
    metadataKey(record.id),
    Buffer.from(JSON.stringify(record, null, 2), "utf-8"),
    "application/json"
  );
}

export async function listBookRecords(): Promise<BookRecord[]> {
  return (await readJson<BookRecord[]>(INDEX_KEY)) ?? [];
}

export async function getBookRecord(id: string): Promise<BookRecord> {
  const record = await readJson<BookRecord>(metadataKey(id));
  if (!record) throw new ServiceError(404, "Book not found");
  return record;
}

/** The library as one profile sees it — every book with that profile's
 * rating, read flag, and progress applied. */
export async function listBooksForProfile(profileId: string): Promise<Book[]> {
  const [records, state] = await Promise.all([listBookRecords(), getProfileState(profileId)]);
  return records.map((record) => applyProfileState(record, state[record.id]));
}

export async function getBookForProfile(profileId: string, id: string): Promise<Book> {
  const [record, state] = await Promise.all([getBookRecord(id), getProfileState(profileId)]);
  return applyProfileState(record, state[id]);
}

function uniqueSlug(baseSlug: string, contentHash: string, taken: Set<string>): string {
  if (!taken.has(baseSlug)) return baseSlug;
  const withSuffix = `${baseSlug}-${contentHash.slice(0, 6)}`;
  if (!taken.has(withSuffix)) return withSuffix;
  let n = 2;
  while (taken.has(`${withSuffix}-${n}`)) n++;
  return `${withSuffix}-${n}`;
}

/** Stores an EPUB and unpacks it for the reader. A book with the same
 * content is not added twice — the existing one comes back with `duplicate`. */
export async function addBookFromEpub(buffer: Buffer): Promise<{ book: BookRecord; duplicate: boolean }> {
  const { uploadMaxSizeMb } = await getSettings();
  if (buffer.length > uploadMaxSizeMb * 1024 * 1024) {
    throw new ServiceError(413, `File is larger than the ${uploadMaxSizeMb}MB upload limit (Settings → Library)`);
  }

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const storage = getStorage();

  const index = await listBookRecords();
  const existing = index.find((b) => b.contentHash === contentHash);
  if (existing) return { book: existing, duplicate: true };

  let metadata;
  try {
    metadata = parseEpubMetadata(buffer);
  } catch (error) {
    throw new ServiceError(400, (error as Error).message);
  }

  const id = uniqueSlug(slugify(metadata.title), contentHash, new Set(index.map((b) => b.id)));
  const cover = extractEpubCover(buffer, metadata);

  await storage.put(`books/${id}/book.epub`, buffer, "application/epub+zip");
  if (cover) {
    await storage.put(`books/${id}/cover.${cover.extension}`, cover.data, cover.contentType);
  }

  // epub.js's archived-URL mode (feeding it the raw .epub) never reliably
  // resolves book.opened, so the reader needs the archive unpacked and
  // served as plain files, opened via the OPF instead of the zip.
  const files = extractAllEpubFiles(buffer);
  await Promise.all(
    Object.entries(files)
      .filter(([path, data]) => !path.endsWith("/") && data.length > 0)
      .map(([path, data]) => storage.put(`books/${id}/content/${path}`, Buffer.from(data), contentTypeFor(path)))
  );

  const book: BookRecord = {
    id,
    contentHash,
    title: metadata.title,
    author: metadata.author,
    isbn: metadata.isbn,
    lang: metadata.language,
    size: buffer.length,
    addedAt: new Date().toISOString(),
    hasCover: !!cover,
    coverExt: cover?.extension,
    coverUpdatedAt: cover ? new Date().toISOString() : undefined,
    opfPath: metadata.opfPath,
  };

  await writeRecord(book);
  await mutateJson<BookRecord[]>(INDEX_KEY, (current) => [...(current ?? []).filter((b) => b.id !== id), book]);
  return { book, duplicate: false };
}

/** Downloads an EPUB from a web address and adds it to the library. */
export async function addBookFromUrl(rawUrl: string): Promise<{ book: BookRecord; duplicate: boolean }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ServiceError(400, "That doesn't look like a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ServiceError(400, "Only http/https URLs are supported");
  }

  const { uploadMaxSizeMb } = await getSettings();
  const maxBytes = uploadMaxSizeMb * 1024 * 1024;
  const tooBig = new ServiceError(413, `File is larger than the ${uploadMaxSizeMb}MB upload limit (Settings → Library)`);

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": openLibraryUserAgent() } });
  } catch {
    throw new ServiceError(502, "Couldn't reach that address");
  }
  if (!res.ok) throw new ServiceError(502, `Download failed (${res.status})`);
  // Checked before reading the body so a huge file isn't pulled into memory.
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw tooBig;

  return addBookFromEpub(Buffer.from(await res.arrayBuffer()));
}

export interface CoverUpload {
  data: Buffer;
  contentType: string;
}

export async function downloadCover(url: string): Promise<CoverUpload> {
  const res = await fetch(url, { headers: { "User-Agent": openLibraryUserAgent() } });
  if (!res.ok) throw new ServiceError(502, "Failed to download cover");
  return {
    data: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  };
}

const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 40;

/** Trims, drops blanks, dedupes case-insensitively (keeping first-seen casing), and caps count/length. */
export function normalizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(trimmed);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

export interface BookMetadataPatch {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  /** `null` removes the book from its series */
  series?: BookRecord["series"] | null;
  cover?: CoverUpload;
}

/** Leaves anything not in the patch as it is. */
export async function updateBookMetadata(id: string, patch: BookMetadataPatch): Promise<BookRecord> {
  const book = await getBookRecord(id);

  let { hasCover, coverExt, coverUpdatedAt } = book;
  if (patch.cover) {
    const ext = patch.cover.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    await getStorage().put(`books/${id}/cover.${ext}`, patch.cover.data, patch.cover.contentType);
    hasCover = true;
    coverExt = ext;
    coverUpdatedAt = new Date().toISOString();
  }

  const updated: BookRecord = {
    ...book,
    title: patch.title || book.title,
    author: patch.author || book.author,
    description: patch.description ?? book.description,
    hasCover,
    coverExt,
    coverUpdatedAt,
    tags: patch.tags ?? book.tags,
    series: patch.series === null ? undefined : (patch.series ?? book.series),
  };

  await writeRecord(updated);
  await mutateJson<BookRecord[]>(INDEX_KEY, (current) => (current ?? []).map((b) => (b.id === id ? updated : b)));
  return updated;
}

/** Callers decide who may delete (the app only lets admins). */
export async function deleteBook(id: string): Promise<void> {
  await getBookRecord(id);

  const storage = getStorage();
  const keys = await storage.list(`books/${id}/`);
  await Promise.all(keys.map((key) => storage.delete(key)));

  await mutateJson<BookRecord[]>(INDEX_KEY, (current) => (current ?? []).filter((b) => b.id !== id));

  const profiles = await listProfiles();
  await Promise.all(profiles.map((p) => deleteProfileBookState(p.id, id)));
}

export interface BookStatePatch {
  rating?: number;
  read?: boolean;
  cfi?: string;
  progress?: number;
}

/** Rating (0 clears it), read flag, and reading position — all per-profile. */
export async function setBookState(profileId: string, id: string, body: BookStatePatch): Promise<Book> {
  const record = await getBookRecord(id);

  const patch: Partial<ProfileBookState> = {};
  if (body.rating !== undefined) {
    if (typeof body.rating !== "number" || !Number.isInteger(body.rating) || body.rating < 0 || body.rating > 5) {
      throw new ServiceError(400, "rating must be an integer 0-5");
    }
    patch.rating = body.rating === 0 ? undefined : body.rating;
  }
  if (body.read !== undefined) patch.read = !!body.read;
  if (typeof body.cfi === "string") {
    patch.cfi = body.cfi;
    patch.lastReadAt = new Date().toISOString();
  }
  if (typeof body.progress === "number") {
    patch.progress = Math.min(100, Math.max(0, Math.round(body.progress)));
  }

  const state = await updateProfileBookState(profileId, id, patch);
  return applyProfileState(record, state);
}

/** Emails the EPUB to the profile's e-reader address using the SMTP settings. */
export async function sendBookToEreader(profile: Profile, id: string): Promise<{ sentTo: string }> {
  const book = await getBookRecord(id);
  const settings = await getSettings();

  if (!settings.smtp.host || !settings.smtp.fromAddress) {
    throw new ServiceError(400, "SMTP isn't configured yet — set it up in Settings → E-Reader Email.");
  }
  if (!profile.ereaderEmail) {
    throw new ServiceError(400, "No e-reader email set for this profile — add one in Settings → Profile.");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of await getStorage().get(`books/${id}/book.epub`)) chunks.push(chunk as Buffer);
  const buffer = Buffer.concat(chunks);

  const encryption = settings.smtp.encryption ?? "none";
  const transport = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port ?? 587,
    secure: encryption === "ssl",
    requireTLS: encryption === "starttls",
    auth: settings.smtp.user ? { user: settings.smtp.user, pass: settings.smtp.pass } : undefined,
  });

  try {
    await transport.sendMail({
      from: settings.smtp.fromAddress,
      to: profile.ereaderEmail,
      subject: book.title,
      text: `Sent from Bookhoarder: ${book.title} by ${book.author}`,
      attachments: [{ filename: `${book.title}.epub`, content: buffer }],
    });
  } catch (error) {
    throw new ServiceError(502, (error as Error).message || "Failed to send email");
  }
  return { sentTo: profile.ereaderEmail };
}

/** Drains a provider stream (metadata candidates, similar, trending) into one
 * flat list. Each result already says which provider it came from. */
export async function collectProviderResults<T>(
  stream: AsyncGenerator<{ providerLabel: string; results: T[] }>
): Promise<T[]> {
  const all: T[] = [];
  for await (const chunk of stream) all.push(...chunk.results);
  return all;
}
