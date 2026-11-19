import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/profiles/store";
import { serviceErrorResponse } from "@/lib/books/http";
import { sendBookToEreader } from "@/lib/books/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getActiveProfile();
  try {
    const { sentTo } = await sendBookToEreader(profile, id);
    return NextResponse.json({ ok: true, sentTo });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
