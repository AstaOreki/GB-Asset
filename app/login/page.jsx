"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import MinimalHeader from "../../components/MinimalHeader";
import MinimalFooter from "../../components/MinimalFooter";
import { useGBA } from "../../hooks/useGBA";
import { useButtonRipple } from "../../hooks/useButtonRipple";
import "./login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Friendly Firebase auth error copy — verbatim from login.html, do not paraphrase.
const FRIENDLY_ERRORS = {
  "auth/invalid-email": "That email address looks invalid.",
  "auth/user-not-found": "No account found for that email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account already exists for that email.",
  "auth/weak-password": "Password should be at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email using a different sign-in method.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and try again.",
};

function friendlyAuthError(err) {
  const code = err && err.code;
  return (code && FRIENDLY_ERRORS[code]) || (err && err.message) || "Something went wrong. Please try again.";
}

/**
 * /login route. Wrapped in Suspense because AuthPanel calls
 * useSearchParams() (reads ?redirect=) — Next.js requires a Suspense
 * boundary around any client component using that hook, otherwise `next
 * build` warns/bails on the prerender of this route.
 */
export default function LoginPage() {
  return (
    <>
      <MinimalHeader />
      <main>
        <div className="main-glow" />
        <Suspense fallback={null}>
          <AuthPanel />
        </Suspense>
      </main>
      <MinimalFooter />
    </>
  );
}

function AuthPanel() {
  const gba = useGBA();
  const searchParams = useSearchParams();
  useButtonRipple();

  const panelRef = useRef(null);

  const [mode, setMode] = useState("login"); // 'login' | 'register'

  // ---- login form state ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [loginEmailInvalid, setLoginEmailInvalid] = useState(false);
  const [loginPasswordInvalid, setLoginPasswordInvalid] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginStatus, setLoginStatus] = useState("");
  const [loginStatusShown, setLoginStatusShown] = useState(false);

  // ---- register form state ----
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [regPasswordVisible, setRegPasswordVisible] = useState(false);
  const [regConfirmVisible, setRegConfirmVisible] = useState(false);
  const [regNameInvalid, setRegNameInvalid] = useState(false);
  const [regEmailInvalid, setRegEmailInvalid] = useState(false);
  const [regPhoneInvalid, setRegPhoneInvalid] = useState(false);
  const [regPasswordInvalid, setRegPasswordInvalid] = useState(false);
  const [regConfirmInvalid, setRegConfirmInvalid] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerStatus, setRegisterStatus] = useState("");
  const [registerStatusShown, setRegisterStatusShown] = useState(false);

  // ---- google sign-in state ----
  const [googleBusy, setGoogleBusy] = useState(false);

  function redirectTarget() {
    const r = searchParams.get("redirect");
    if (r === "admin") return "/admin_dashboard.html";
    if (r === "checkout") return "/checkout";
    return "/";
  }

  // Redirect-if-already-authenticated: subscribe once GBA is ready.
  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange(function (user) {
      if (user) {
        window.location.href = redirectTarget();
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gba]);

  // Completes the mobile signInWithRedirect Google flow (see gba-firebase.js
  // — mobile browsers block signInWithPopup, so that path navigates away to
  // Google and back here instead). No-ops if there's no pending redirect.
  useEffect(() => {
    if (!gba) return;
    gba
      .checkGoogleRedirectResult()
      .then((user) => {
        if (user) window.location.href = redirectTarget();
      })
      .catch((err) => {
        if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) return;
        setLoginStatus(friendlyAuthError(err));
        setLoginStatusShown(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gba]);

  // Magnetic hover on this page's submit buttons (matches index.html's
  // effect, scoped locally since there's no shared useMagneticHover hook).
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    const els = panelRef.current ? panelRef.current.querySelectorAll(".submit-btn") : [];

    function onMouseMove(e) {
      const rect = this.getBoundingClientRect();
      const mx = (e.clientX - rect.left - rect.width / 2) * 0.18;
      const my = (e.clientY - rect.top - rect.height / 2) * 0.28;
      this.style.transform = `translate(${mx}px,${my}px) scale(1.03)`;
    }
    function onMouseLeave() {
      this.style.transform = "";
    }

    els.forEach((el) => {
      el.addEventListener("mousemove", onMouseMove);
      el.addEventListener("mouseleave", onMouseLeave);
    });
    return () => {
      els.forEach((el) => {
        el.removeEventListener("mousemove", onMouseMove);
        el.removeEventListener("mouseleave", onMouseLeave);
      });
    };
  }, []);

  function handleLoginSubmit(e) {
    e.preventDefault();
    const email = loginEmail.trim();
    const pass = loginPassword;
    const remember = rememberMe;
    let ok = true;

    if (!EMAIL_RE.test(email)) {
      setLoginEmailInvalid(true);
      ok = false;
    } else {
      setLoginEmailInvalid(false);
    }

    if (pass.length === 0) {
      setLoginPasswordInvalid(true);
      ok = false;
    } else {
      setLoginPasswordInvalid(false);
    }

    if (!ok) {
      setLoginStatusShown(false);
      return;
    }
    if (!gba) {
      setLoginStatus("Service unavailable — please try again shortly.");
      setLoginStatusShown(true);
      return;
    }

    setLoginSubmitting(true);
    gba
      .login({ email, password: pass, remember })
      .then(() => {
        setLoginStatus("Sign-in successful. Redirecting to your account…");
        setLoginStatusShown(true);
        setTimeout(() => {
          window.location.href = redirectTarget();
        }, 700);
      })
      .catch((err) => {
        setLoginSubmitting(false);
        setLoginStatus(friendlyAuthError(err));
        setLoginStatusShown(true);
      });
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = regName.trim();
    const email = regEmail.trim();
    const phone = regPhone.trim();
    const pass = regPassword;
    const confirm = regConfirm;
    const terms = agreeTerms;
    let ok = true;

    setRegNameInvalid(name.length === 0);
    if (name.length === 0) ok = false;

    if (!EMAIL_RE.test(email)) {
      setRegEmailInvalid(true);
      ok = false;
    } else {
      setRegEmailInvalid(false);
    }

    if (phone.replace(/\D/g, "").length < 7) {
      setRegPhoneInvalid(true);
      ok = false;
    } else {
      setRegPhoneInvalid(false);
    }

    if (pass.length < 8) {
      setRegPasswordInvalid(true);
      ok = false;
    } else {
      setRegPasswordInvalid(false);
    }

    if (confirm !== pass || confirm.length === 0) {
      setRegConfirmInvalid(true);
      ok = false;
    } else {
      setRegConfirmInvalid(false);
    }

    if (!terms) ok = false;

    if (!ok) {
      setRegisterStatusShown(false);
      return;
    }
    if (!gba) {
      setRegisterStatus("Service unavailable — please try again shortly.");
      setRegisterStatusShown(true);
      return;
    }

    setRegisterSubmitting(true);
    gba
      .register({ name, email, phone, password: pass })
      .then(() => {
        setRegisterStatus("Account created successfully. Redirecting to your account…");
        setRegisterStatusShown(true);
        setTimeout(() => {
          window.location.href = redirectTarget();
        }, 700);
      })
      .catch((err) => {
        setRegisterSubmitting(false);
        setRegisterStatus(friendlyAuthError(err));
        setRegisterStatusShown(true);
      });
  }

  function handleGoogleClick() {
    if (!gba) return;
    const setActiveStatus = mode === "register" ? setRegisterStatus : setLoginStatus;
    const setActiveShown = mode === "register" ? setRegisterStatusShown : setLoginStatusShown;

    setGoogleBusy(true);
    gba
      .loginWithGoogle()
      .then(() => {
        setActiveStatus("Sign-in successful. Redirecting to your account…");
        setActiveShown(true);
        setTimeout(() => {
          window.location.href = redirectTarget();
        }, 700);
      })
      .catch((err) => {
        setGoogleBusy(false);
        if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) {
          return;
        }
        setActiveStatus(friendlyAuthError(err));
        setActiveShown(true);
      });
  }

  function handleForgotClick(e) {
    e.preventDefault();
    const email = loginEmail.trim();
    if (!EMAIL_RE.test(email)) {
      setLoginEmailInvalid(true);
      setLoginStatus('Enter your email above first, then click "Forgot password?" again.');
      setLoginStatusShown(true);
      return;
    }
    if (!gba) return;
    gba
      .resetPassword(email)
      .then(() => {
        setLoginStatus("If an account exists for that email, password reset instructions have been sent.");
        setLoginStatusShown(true);
      })
      .catch(() => {
        setLoginStatus("If an account exists for that email, password reset instructions have been sent.");
        setLoginStatusShown(true);
      });
  }

  return (
    <section className="auth-panel" ref={panelRef}>
      <div className="auth-wrap">
        <div className="auth-head">
          <div className="eyebrow">GBA Asset</div>
          <div className="hairline-dot" />
          <h2 id="headTitle">{mode === "login" ? "Welcome Back" : "Create Your Account"}</h2>
          <p id="headSub">
            {mode === "login" ? "Sign in to continue to your account" : "Register to unlock wholesale gold pricing"}
          </p>
        </div>

        <div className="tabs" data-active={mode} id="tabs">
          <div className="tab-indicator" />
          <button
            className={`tab-btn${mode === "login" ? " active" : ""}`}
            id="tabLogin"
            type="button"
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={`tab-btn${mode === "register" ? " active" : ""}`}
            id="tabRegister"
            type="button"
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div className="glass-card">
          {/* LOGIN FORM */}
          <form className={`auth-form${mode === "login" ? " active" : ""}`} id="loginForm" noValidate onSubmit={handleLoginSubmit}>
            <div className={`field${loginEmailInvalid ? " invalid" : ""}`} id="loginEmailField">
              <input
                autoComplete="email"
                id="loginEmail"
                placeholder=" "
                required
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
              <label htmlFor="loginEmail">Email Address</label>
              <div className="error">Please enter a valid email address.</div>
            </div>
            <div className={`field${loginPasswordInvalid ? " invalid" : ""}`} id="loginPasswordField">
              <input
                autoComplete="current-password"
                id="loginPassword"
                placeholder=" "
                required
                type={loginPasswordVisible ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <label htmlFor="loginPassword">Password</label>
              <span className="toggle-eye" data-target="loginPassword" onClick={() => setLoginPasswordVisible((v) => !v)}>
                <svg viewBox="0 0 24 24">
                  <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </span>
              <div className="error">Password is required.</div>
            </div>
            <div className="row-between">
              <label className="checkline">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />{" "}
                Remember me
              </label>
              <a className="forgot-link" href="#" id="forgotLink" onClick={handleForgotClick}>
                Forgot password?
              </a>
            </div>
            <button className="submit-btn" data-ripple="" type="submit" disabled={loginSubmitting}>
              Sign In
            </button>
            <div className={`status-msg${loginStatusShown ? " show" : ""}`} id="loginStatus">
              {loginStatus}
            </div>
          </form>

          {/* REGISTER FORM */}
          <form
            className={`auth-form${mode === "register" ? " active" : ""}`}
            id="registerForm"
            noValidate
            onSubmit={handleRegisterSubmit}
          >
            <div className={`field${regNameInvalid ? " invalid" : ""}`} id="regNameField">
              <input
                autoComplete="name"
                id="regName"
                placeholder=" "
                required
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
              <label htmlFor="regName">Full Name</label>
              <div className="error">Please enter your full name.</div>
            </div>
            <div className={`field${regEmailInvalid ? " invalid" : ""}`} id="regEmailField">
              <input
                autoComplete="email"
                id="regEmail"
                placeholder=" "
                required
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
              <label htmlFor="regEmail">Email Address</label>
              <div className="error">Please enter a valid email address.</div>
            </div>
            <div className={`field${regPhoneInvalid ? " invalid" : ""}`} id="regPhoneField">
              <input
                autoComplete="tel"
                id="regPhone"
                placeholder=" "
                required
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
              <label htmlFor="regPhone">Phone Number</label>
              <div className="error">Please enter a valid phone number.</div>
            </div>
            <div className={`field${regPasswordInvalid ? " invalid" : ""}`} id="regPasswordField">
              <input
                autoComplete="new-password"
                id="regPassword"
                placeholder=" "
                required
                type={regPasswordVisible ? "text" : "password"}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
              <label htmlFor="regPassword">Password</label>
              <span className="toggle-eye" data-target="regPassword" onClick={() => setRegPasswordVisible((v) => !v)}>
                <svg viewBox="0 0 24 24">
                  <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </span>
              <div className="hint">At least 8 characters.</div>
              <div className="error">Password must be at least 8 characters.</div>
            </div>
            <div className={`field${regConfirmInvalid ? " invalid" : ""}`} id="regConfirmField">
              <input
                autoComplete="new-password"
                id="regConfirm"
                placeholder=" "
                required
                type={regConfirmVisible ? "text" : "password"}
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
              />
              <label htmlFor="regConfirm">Confirm Password</label>
              <span className="toggle-eye" data-target="regConfirm" onClick={() => setRegConfirmVisible((v) => !v)}>
                <svg viewBox="0 0 24 24">
                  <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </span>
              <div className="error">Passwords do not match.</div>
            </div>
            <div className="row-between" style={{ justifyContent: "flex-start" }}>
              <label className="checkline">
                <input
                  id="agreeTerms"
                  required
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />{" "}
                I agree to the{" "}
                <a className="forgot-link" href="#" style={{ marginLeft: "4px" }}>
                  Terms &amp; Privacy Policy
                </a>
              </label>
            </div>
            <button className="submit-btn" data-ripple="" type="submit" disabled={registerSubmitting}>
              Create Account
            </button>
            <div className={`status-msg${registerStatusShown ? " show" : ""}`} id="registerStatus">
              {registerStatus}
            </div>
          </form>
        </div>

        <div className="divider">
          <span className="line"></span>or<span className="line"></span>
        </div>
        <button className="google-btn" id="googleSignInBtn" type="button" disabled={googleBusy} onClick={handleGoogleClick}>
          <svg height="18" viewBox="0 0 18 18" width="18">
            <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" fill="#4285F4"></path>
            <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z" fill="#34A853"></path>
            <path d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.98a9 9 0 0 0 0 8.08l2.97-2.33Z" fill="#FBBC05"></path>
            <path d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.96l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z" fill="#EA4335"></path>
          </svg>
          <span id="googleBtnLabel">{googleBusy ? "Connecting…" : "Continue with Google"}</span>
        </button>
        <p className="switch-msg" id="switchLoginToRegister" style={{ display: mode === "register" ? "none" : undefined }}>
          Don&apos;t have an account?{" "}
          <button id="goRegister" type="button" onClick={() => setMode("register")}>
            Register here
          </button>
        </p>
        <p className="switch-msg" id="switchRegisterToLogin" style={{ display: mode === "login" ? "none" : undefined }}>
          Already have an account?{" "}
          <button id="goLogin" type="button" onClick={() => setMode("login")}>
            Sign in
          </button>
        </p>
      </div>
    </section>
  );
}
