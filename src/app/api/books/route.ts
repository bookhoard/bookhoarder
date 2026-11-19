import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/books/http";
import { addBookFromEpub, listBookRecords } from "@/lib/books/service";

export async function GET() {
  return NextResponse.json({ books: await listBookRecords() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    return NextResponse.json({ error: "Only .epub files are supported" }, { status: 400 });
  }

  try {
    const { book, duplicate } = await addBookFromEpub(Buffer.from(await file.arrayBuffer()));
    return duplicate
      ? NextResponse.json({ book, duplicate: true })
      : NextResponse.json({ book, duplicate: false }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
