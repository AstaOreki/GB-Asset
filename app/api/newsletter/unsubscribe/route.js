import { unsubscribeByToken } from "../../../../lib/newsletter";

// Headless POST endpoint for RFC 8058 one-click unsubscribe — this is what
// Gmail/Yahoo/Outlook actually call when a recipient taps the native
// "Unsubscribe" button next to the sender name (not the link in the email
// body, which instead navigates to the /unsubscribe PAGE for a human to see
// a confirmation). Both paths call the same unsubscribeByToken() so there is
// one unsubscribe implementation, two entry points.
export async function POST(request) {
  let token = null;
  try {
    const body = await request.json();
    token = body && body.token;
  } catch {
    // RFC 8058 senders POST with no body / a form-encoded body some mail
    // clients don't set a JSON content-type for — fall back to the query
    // string, which is what the "mailto"-less List-Unsubscribe URL carries.
    token = new URL(request.url).searchParams.get("token");
  }

  try {
    const result = await unsubscribeByToken(token);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Could not process this request." }, { status: 500 });
  }
}
