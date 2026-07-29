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
import { getAuth } from "firebase-admin/auth";

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

export function getAdminAuth() {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}
