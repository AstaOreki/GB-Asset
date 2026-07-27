# GB Asset — Firebase Setup

Follow these steps in order. Steps 1–5 get the site running against a real
Firebase backend; step 6 (publishing the rules) is what actually secures it —
don't skip it.

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com
2. Click **Add project**, give it a name, finish the wizard.

## 2. Register a web app
1. In the project, click the **</>** (web) icon under "Your apps".
2. Give the app a nickname and click **Register app**.
3. Firebase shows you a `firebaseConfig` object — keep this tab open, you'll
   need it in step 5.

## 3. Enable sign-in providers
1. In the left sidebar: **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, enable **Email/Password**.
4. Also enable **Google** (needed for the "Continue with Google" button on
   `login.html`) — pick a project support email when prompted.
5. If you test the Google button from anywhere other than `localhost` or a
   Firebase Hosting domain, add that domain under **Authentication →
   Settings → Authorized domains** first, or the popup will fail. Opening
   `login.html` directly as a `file://` URL will NOT work for Google
   sign-in — serve it over `http://localhost` instead.

## 4. Create the Firestore database
1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to your users, and start in **production mode**
   (this just means it starts fully locked down — that's fine, step 6
   publishes the real rules).

## 5. Paste your config into the site
1. Open `public/js/firebase-config.js`.
2. Replace the placeholder values with the ones from step 2:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
3. In the same file, add your own email address(es) to `ADMIN_EMAILS` — this
   is what lets you into `admin_dashboard.html` after logging in:
   ```js
   const ADMIN_EMAILS = [
     "you@example.com"
   ];
   ```

## 6. Publish the security rules (required)
Right now, nothing stops anyone with your `firebaseConfig` (which is visible
in your page source — that's normal for Firebase) from reading or writing
your entire database directly. The rules are what actually protect you, not
the config being secret.

1. In the left sidebar: **Build → Firestore Database → Rules**.
2. Delete the existing contents and paste in everything from
   `firestore.rules` (in this folder).
3. Click **Publish**.

**Important:** `firestore.rules` has its own copy of the admin email list
(Firestore rules can't read your JS file), so if you add or change an admin
email in `public/js/firebase-config.js`, update the matching list near the top of
`firestore.rules` too, then re-publish.

## After this
- The first time each admin-dashboard query (orders, consultations, logs,
  announcements — all ordered by date) runs against your real database,
  Firebase may show a message in the console asking you to create a
  composite index. Just click the link it gives you; it's a one-click
  approval and only needs to happen once per query.
- Real card payments aren't wired up yet — "Card" is currently just a
  selectable payment method that saves the order as `pending`. Connecting a
  real charge (Stripe, PayPal, etc.) is a separate step that requires you to
  have a payment gateway account first.
