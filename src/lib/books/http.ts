import { NextResponse } from "next/server";
import { ServiceError } from "./service";

/** Turns a ServiceError into the JSON error response the API always used;
 * anything else is a real bug and keeps bubbling up as a 500. */
export function serviceErrorResponse(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
