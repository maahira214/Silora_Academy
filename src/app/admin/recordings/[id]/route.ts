import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { openRecording } from "@/server/recordings";

// Opens a class recording in Google Drive. Super Admins only; every viewing is recorded.
export async function GET(_: NextRequest, ctx: RouteContext<"/admin/recordings/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const url = await openRecording(user, id);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url);
}
