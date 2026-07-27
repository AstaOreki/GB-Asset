/* ==========================================================================
   FIREBASE CONFIG — GB Asset
   ==========================================================================
   1. Go to https://console.firebase.google.com → create a project.
   2. Project settings → General → "Your apps" → Add app → Web (</>) icon.
   3. Copy the config object Firebase gives you and paste the values below.
   4. In the Firebase console, enable:
        - Authentication → Sign-in method → Email/Password
        - Firestore Database → Create database (start in production mode)
   5. Paste the contents of firestore.rules (in this folder) into
      Firestore → Rules, and publish.
   6. Add your own email(s) to ADMIN_EMAILS below so you can access
      admin_dashboard.html.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBVmY7O8zswhirZ5KaYWBPyNsKc-h1-HuU",
  authDomain: "gb-asset.firebaseapp.com",
  projectId: "gb-asset",
  storageBucket: "gb-asset.firebasestorage.app",
  messagingSenderId: "458739081713",
  appId: "1:458739081713:web:bc1e871b28d78c45996450"
};

// Anyone signed in with one of these emails can access admin_dashboard.html.
// (For real production security also lock this down with Firestore rules —
// see firestore.rules — since this array alone is only a UI-level gate.)
const ADMIN_EMAILS = [
"astaoreki@gmail.com",
"ezurazz@gmail.com"
];