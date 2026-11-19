import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/books/http";
import {
  downloadCover,
  getBookRecord,
  normalizeTags,
  updateBookMetadata,
  type BookMetadataPatch,
} from "@/lib/books/service";

interface ApplyMetadataBody {
  title?: string;
  author?: string;
  description?: string;
  coverUrl?: string;
}

function stringField(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

function parseTagsField(value: FormDataEntryValue | null): string[] | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return normalizeTags(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function parseSeries(
  name: FormDataEntryValue | null,
  position: FormDataEntryValue | null
): BookMetadataPatch["series"] {
  if (typeof name !== "string") return undefined;
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  const parsedPosition = typeof position === "string" ? Number(position) : NaN;
  return {
    name: trimmedName,
    position: Number.isFinite(parsedPosition) && parsedPosition >= 0 ? parsedPosition : 0,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await getBookRecord(id);

    const patch: BookMetadataPatch = {};
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      patch.title = stringField(form, "title");
      patch.author = stringField(form, "author");
      patch.description = stringField(form, "description");
      patch.tags = parseTagsField(form.get("tags"));
      patch.series = parseSeries(form.get("seriesName"), form.get("seriesPosition"));

      const cover = form.get("cover");
      if (cover instanceof File) {
        if (!cover.type.startsWith("image/")) {
          return NextResponse.json({ error: "Cover must be an image file" }, { status: 400 });
        }
        patch.cover = { data: Buffer.from(await cover.arrayBuffer()), contentType: cover.type };
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as ApplyMetadataBody;
      patch.title = body.title;
      patch.author = body.author;
      patch.description = body.description;
      if (body.coverUrl) patch.cover = await downloadCover(body.coverUrl);
    }

    return NextResponse.json({ book: await updateBookMetadata(id, patch) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
