import { subscribeEmail } from "../../../../lib/newsletter";

// Public — the homepage's "Get Daily Gold Updates" form. Server-side (not a
// direct client Firestore write) so the transaction that prevents duplicate
// subscriber docs, the token generation, and email validation all live in
// one place — see lib/newsletter.js's subscribeEmail() header comment for
// why this collection isn't publicly writable via Firestore rules at all.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body && body.email;
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Please enter your email address." }, { status: 400 });
  }

  try {
    const result = await subscribeEmail(email);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({
      ok: true,
      message: result.alreadyActive
        ? "You're already subscribed to GBA Gold Daily Updates."
        : "You're subscribed! Watch your inbox for daily gold updates.",
    });
  } catch (err) {
    return Response.json({ error: err.message || "Something went wrong. Please try again." }, { status: 500 });
  }
}
