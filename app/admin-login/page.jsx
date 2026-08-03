"use client";

import { useEffect, useState } from "react";
import MinimalHeader from "../../components/MinimalHeader";
import MinimalFooter from "../../components/MinimalFooter";
import { useGBA } from "../../hooks/useGBA";
import { useButtonRipple } from "../../hooks/useButtonRipple";
import "./admin-login.css";

const FRIENDLY_ERRORS = {
  "auth/invalid-email": "That email address looks invalid.",
  "auth/user-not-found": "No account found for that email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
};

function friendlyAuthError(err) {
  const code = err && err.code;
  return (code && FRIENDLY_ERRORS[code]) || (err && err.message) || "Something went wrong. Please try again.";
}

/**
 * /admin-login — a dedicated, admin-only sign-in page, separate from the
 * shared customer /login (no register tab, no Google sign-in). Redirects
 * to /admin_dashboard.html on success; a valid but non-admin login is
 * signed back out immediately with an inline error.
 */
export default function AdminLoginPage() {
  const gba = useGBA();
  useButtonRipple();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [statusShown, setStatusShown] = useState(false);

  // If already signed in as an admin, skip straight through.
  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange((user) => {
      if (user && gba.isAdmin(user)) {
        window.location.href = "/admin_dashboard.html";
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!gba) {
      setStatus("Service unavailable — please try again shortly.");
      setStatusShown(true);
      return;
    }

    setSubmitting(true);
    gba
      .login({ email: email.trim(), password, remember: true })
      .then((user) => {
        if (!gba.isAdmin(user)) {
          return gba.logout().then(() => {
            setSubmitting(false);
            setStatus(`This account (${user.email}) is not authorized for admin access.`);
            setStatusShown(true);
          });
        }
        setStatus("Sign-in successful. Redirecting…");
        setStatusShown(true);
        window.location.href = "/admin_dashboard.html";
      })
      .catch((err) => {
        setSubmitting(false);
        setStatus(friendlyAuthError(err));
        setStatusShown(true);
      });
  }

  return (
    <>
      <MinimalHeader />
      <main>
        <div className="main-glow" />
        <section className="auth-panel">
          <div className="auth-wrap">
            <div className="auth-head">
              <div className="eyebrow">GB Asset</div>
              <div className="hairline-dot" />
              <h2>Admin Sign In</h2>
              <p>Restricted access — institutional vault dashboard</p>
            </div>

            <div className="glass-card">
              <form noValidate onSubmit={handleSubmit}>
                <div className="field">
                  <input
                    autoComplete="email"
                    id="adminEmail"
                    placeholder=" "
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <label htmlFor="adminEmail">Admin Email</label>
                </div>
                <div className="field">
                  <input
                    autoComplete="current-password"
                    id="adminPassword"
                    placeholder=" "
                    required
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <label htmlFor="adminPassword">Password</label>
                  <span className="toggle-eye" onClick={() => setPasswordVisible((v) => !v)}>
                    <svg viewBox="0 0 24 24">
                      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </span>
                </div>
                <button className="submit-btn" data-ripple="" type="submit" disabled={submitting}>
                  Sign In
                </button>
                <div className={`status-msg${statusShown ? " show" : ""}`}>{status}</div>
              </form>
            </div>
          </div>
        </section>
      </main>
      <MinimalFooter />
    </>
  );
}
