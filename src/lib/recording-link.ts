/**
 * Class recordings live in Silora's Google Drive. Only Drive file links are accepted, so a
 * recording can't point somewhere public by mistake. Returns the cleaned link, or null.
 */
export function parseDriveLink(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "drive.google.com") return null;
  const id = u.pathname.match(/^\/file\/d\/([\w-]{10,})/)?.[1] ?? (u.pathname === "/open" ? u.searchParams.get("id") : null);
  if (!id || !/^[\w-]{10,}$/.test(id)) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}
