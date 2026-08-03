// Server-only Firebase Admin access. Originally used solely by the Stripe
// webhook to mark an order "paid" after Stripe confirms payment
// server-to-server; also now used by app/api/create-order (see that file's
// header comment for why order creation needed to move server-side).
// The client SDK (public/js/gba-firebase.js) can't do either of these
// itself — Firestore rules never let a client mark its own order "paid",
// and a webhook has no signed-in user at all. Admin credentials bypass
// rules entirely, so this must never be imported into client code.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined;

  if (!projectId || !clientEmail || !privateKey) return null;

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function getAdminDb() {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

// Deliberately NOT firebase-admin/auth's getAuth().verifyIdToken() — that
// import pulls in jwks-rsa -> jose, and jwks-rsa's CJS code does a
// synchronous require() of jose's ESM-only build, which crashes with
// ERR_REQUIRE_ESM in the deployed Vercel function regardless of bundler
// config (confirmed: marking firebase-admin external didn't help, since
// the conflict is inside jwks-rsa's own code, not a bundling issue). This
// hits Google's own token-verification REST endpoint instead — the same
// verification firebase-admin would do internally, just without the
// broken dependency chain. Needs only the public web API key, not an
// admin credential.
export async function verifyIdToken(idToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const user = data.users && data.users[0];
  return user ? { uid: user.localId, email: user.email } : null;
}
