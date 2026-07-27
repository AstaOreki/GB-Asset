import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "GBA Asset | Malaysia's Trusted Bullion & Wholesale Gold Investment",
  description:
    "Malaysia's trusted bullion and wholesale gold investment platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@300;400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}

        {/* Firebase compat SDK + data layer — loaded in this exact order,
            beforeInteractive so window.GBA exists before hydration runs. */}
        <Script
          id="firebase-app-compat"
          src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
          strategy="beforeInteractive"
        />
        <Script
          id="firebase-auth-compat"
          src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"
          strategy="beforeInteractive"
        />
        <Script
          id="firebase-firestore-compat"
          src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
          strategy="beforeInteractive"
        />
        {/* Firebase config comes from env vars (not a hardcoded file) for
            the Next.js app. These values aren't secret — Firebase expects
            them to be visible in the browser, Firestore rules are what
            actually secure the data — but they're centralized here so
            there's one place to rotate them. public/js/firebase-config.js
            keeps its own copy for admin_dashboard.html, a plain static file
            outside the Next.js build that can't read these env vars. */}
        <Script
          id="firebase-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              const firebaseConfig = {
                apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}",
                authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",
                projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}",
                storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",
                messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
                appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}"
              };
              const ADMIN_EMAILS = ${JSON.stringify(
                (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean)
              )};
            `,
          }}
        />
        <Script
          id="gba-firebase"
          src="/js/gba-firebase.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
