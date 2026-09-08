import { NextResponse } from "next/server";
import { readJson } from "@/lib/store";
import { streamSimilarBooks } from "@/lib/metadata/providers/registry";
import { ndjsonResponse } from "@/lib/metadata/ndjson";
import { getSettings } from "@/lib/settings/store";
import type { BookRecord } from "@/lib/books/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const book = await readJson<BookRecord>(`books/${id}/metadata.json`);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const stream = streamSimilarBooks(
    { title: book.title, author: book.author },
    settings.metadataProviders,
    12
  );
  return ndjsonResponse(stream);
}
