/**
 * Plain, branded email for class changes. Never includes Meet links or anyone's
 * contact details: the button opens Silora, which checks access as usual.
 */
export function renderEmail({
  name,
  title,
  body,
  url,
}: {
  name: string;
  title: string;
  body: string;
  /** Absolute link into the app, or undefined for the home page. */
  url: string;
}) {
  const first = name.split(" ")[0] || name;
  const text = [`Hello ${first},`, "", body, "", `Open Silora Academy: ${url}`, "", "— Silora Academy", "Please don't reply to this email. Use Need help? in the app."].join(
    "\n",
  );
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:Montserrat,Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
          <tr><td style="background:#ffffff;padding:16px 24px;border-bottom:4px solid #e8b112;color:#0a2d4a;font-weight:800;font-size:16px;letter-spacing:.5px"><img src="${escapeHtml(new URL("/brand/logo-light.png", url).toString())}" alt="SILORA ACADEMY" height="44" style="display:block;height:44px;width:auto;border:0"></td></tr>
          <tr><td style="padding:24px">
            <p style="margin:0 0 12px;font-size:16px">Hello ${escapeHtml(first)},</p>
            <h1 style="margin:0 0 12px;font-size:20px;color:#0a2d4a">${escapeHtml(title)}</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(body)}</p>
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#e8b112;color:#0a2d4a;text-decoration:none;font-weight:700;font-size:16px;padding:12px 24px;border-radius:999px">Open Silora Academy</a>
          </td></tr>
          <tr><td style="padding:16px 24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">Please don't reply to this email. Use <strong>Need help?</strong> in the app.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject: `${title} · Silora Academy`, text, html };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
