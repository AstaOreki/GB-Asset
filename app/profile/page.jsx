"use client";

import { useEffect, useState } from "react";
import StorefrontHeader from "../../components/StorefrontHeader";
import FullFooter from "../../components/FullFooter";
import { useGBA } from "../../hooks/useGBA";
import { useAuthAwareNav } from "../../hooks/useAuthAwareNav";
import { useButtonRipple } from "../../hooks/useButtonRipple";
import "./profile.css";

const STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu", "Other",
];

export default function ProfilePage() {
  const gba = useGBA();
  const { user, isAuthed, authReady } = useAuthAwareNav();
  useButtonRipple();

  // Placing this page behind login mirrors checkout's gate: wait for the
  // real auth state before redirecting, so a signed-in user whose session
  // hasn't resolved yet isn't wrongly bounced to /login.
  useEffect(() => {
    if (!authReady || isAuthed) return;
    window.location.href = "/login?redirect=profile";
  }, [authReady, isAuthed]);

  const hasPasswordAuth = !!(gba && user && gba.profile.hasPasswordProvider());

  // ---- account name ----
  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameStatus, setNameStatus] = useState("");

  useEffect(() => {
    // Read from Firestore rather than user.displayName: right after
    // register()/updateProfile(), Firebase's client SDK doesn't always
    // re-fire onAuthChange, so the Auth object's displayName can lag one
    // page load behind — Firestore's users/{uid}.name is always current.
    if (!gba || !user) return;
    gba.profile.get().then((profile) => {
      if (profile) setName(profile.name || "");
    });
  }, [gba, user]);

  function handleNameSave(e) {
    e.preventDefault();
    if (!gba || !name.trim()) return;
    setNameSaving(true);
    setNameStatus("");
    gba.profile
      .updateName(name.trim())
      .then(() => {
        setNameSaving(false);
        setNameStatus("Username updated.");
      })
      .catch((err) => {
        setNameSaving(false);
        setNameStatus(err.message || "Could not update username.");
      });
  }

  // ---- password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  function handlePasswordSave(e) {
    e.preventDefault();
    if (!gba) return;

    if (newPassword.length < 8) {
      setPasswordError(true);
      setPasswordStatus("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordStatus("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(false);
    setPasswordStatus("");
    gba.profile
      .changePassword(currentPassword, newPassword)
      .then(() => {
        setPasswordSaving(false);
        setPasswordStatus("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch((err) => {
        setPasswordSaving(false);
        setPasswordError(true);
        const code = err && err.code;
        setPasswordStatus(
          code === "auth/wrong-password" || code === "auth/invalid-credential"
            ? "Current password is incorrect."
            : (err && err.message) || "Could not update password."
        );
      });
  }

  // ---- saved addresses ----
  const [addresses, setAddresses] = useState([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrName, setAddrName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [addrSaving, setAddrSaving] = useState(false);

  function loadAddresses() {
    if (!gba || !user) return;
    gba.profile.addresses.list().then((list) => {
      setAddresses(list);
      setAddressesLoaded(true);
    });
  }

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gba, user]);

  function resetAddrForm() {
    setAddrLabel("");
    setAddrName("");
    setAddrPhone("");
    setAddrLine("");
    setAddrCity("");
    setAddrState("");
    setAddrPostcode("");
  }

  function handleAddAddress(e) {
    e.preventDefault();
    if (!gba || !addrLabel.trim() || !addrLine.trim()) return;
    setAddrSaving(true);
    gba.profile.addresses
      .add({
        label: addrLabel.trim(),
        name: addrName.trim(),
        phone: addrPhone.trim(),
        line: addrLine.trim(),
        city: addrCity.trim(),
        state: addrState,
        postcode: addrPostcode.trim(),
      })
      .then(() => {
        setAddrSaving(false);
        setShowAddForm(false);
        resetAddrForm();
        loadAddresses();
      })
      .catch(() => setAddrSaving(false));
  }

  function handleRemoveAddress(id) {
    if (!gba) return;
    if (!window.confirm("Remove this saved address?")) return;
    gba.profile.addresses.remove(id).then(loadAddresses);
  }

  function handleSignOut() {
    if (!gba) return;
    gba.logout().then(() => {
      window.location.href = "/";
    });
  }

  return (
    <>
      <StorefrontHeader />

      <section className="page-hero">
        <div className="eyebrow">My Account</div>
        <h1>Profile</h1>
      </section>

      <section className="profile-section">
        <div className="wrap profile-wrap">
          <div className="panel profile-block">
            <h3>
              <span className="num">1</span>Account Information
            </h3>
            <form onSubmit={handleNameSave}>
              <div className="field-row">
                <div className="field">
                  <input
                    id="profileName"
                    placeholder=" "
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <label>Username</label>
                </div>
                <div className="field">
                  <input id="profileEmail" disabled placeholder=" " type="email" value={user?.email || ""} />
                  <label>Email Address</label>
                </div>
              </div>
              <button className="submit-btn small" data-ripple="" type="submit" disabled={nameSaving}>
                {nameSaving ? "Saving…" : "Save Changes"}
              </button>
              {nameStatus && <div className="status-msg show">{nameStatus}</div>}
            </form>
          </div>

          <div className="panel profile-block">
            <h3>
              <span className="num">2</span>Change Password
            </h3>
            {hasPasswordAuth ? (
              <form onSubmit={handlePasswordSave}>
                <div className="field">
                  <input
                    autoComplete="current-password"
                    placeholder=" "
                    required
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <label>Current Password</label>
                </div>
                <div className="field-row" style={{ marginTop: 26 }}>
                  <div className="field">
                    <input
                      autoComplete="new-password"
                      placeholder=" "
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <label>New Password</label>
                  </div>
                  <div className="field">
                    <input
                      autoComplete="new-password"
                      placeholder=" "
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <label>Confirm New Password</label>
                  </div>
                </div>
                <button className="submit-btn small" data-ripple="" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? "Updating…" : "Update Password"}
                </button>
                {passwordStatus && (
                  <div className={`status-msg show${passwordError ? " error" : ""}`}>{passwordStatus}</div>
                )}
              </form>
            ) : (
              <p className="profile-note">You signed in with Google, so there&apos;s no password to change here.</p>
            )}
          </div>

          <div className="panel profile-block">
            <h3>
              <span className="num">3</span>Saved Addresses
            </h3>
            {addresses.length > 0 && (
              <div className="address-list">
                {addresses.map((a) => (
                  <div className="address-card" key={a.id}>
                    <div className="address-card-label">{a.label}</div>
                    <div className="address-card-body">
                      {a.name && <b>{a.name}</b>}
                      {a.name && a.phone && " · "}
                      {a.phone}
                      <br />
                      {a.line}
                      {a.city ? `, ${a.city}` : ""}
                      {a.state ? `, ${a.state}` : ""} {a.postcode}
                    </div>
                    <button className="address-remove" type="button" onClick={() => handleRemoveAddress(a.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {addressesLoaded && addresses.length === 0 && !showAddForm && (
              <p className="profile-note">No saved addresses yet — add one so checkout can skip retyping it.</p>
            )}

            {showAddForm ? (
              <form className="address-form" onSubmit={handleAddAddress}>
                <div className="field-row">
                  <div className="field">
                    <input
                      placeholder=" "
                      required
                      type="text"
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                    />
                    <label>Label (e.g. Home, Office)</label>
                  </div>
                  <div className="field">
                    <input placeholder=" " type="text" value={addrName} onChange={(e) => setAddrName(e.target.value)} />
                    <label>Recipient Name</label>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 26 }}>
                  <input placeholder=" " type="tel" value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} />
                  <label>Phone Number</label>
                </div>
                <div className="field" style={{ marginTop: 26 }}>
                  <input
                    placeholder=" "
                    required
                    type="text"
                    value={addrLine}
                    onChange={(e) => setAddrLine(e.target.value)}
                  />
                  <label>Address Line</label>
                </div>
                <div className="field-row three" style={{ marginTop: 26 }}>
                  <div className="field">
                    <input placeholder=" " type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                    <label>City</label>
                  </div>
                  <div className="field">
                    <select
                      data-empty={addrState === "" ? "true" : "false"}
                      value={addrState}
                      onChange={(e) => setAddrState(e.target.value)}
                    >
                      <option value=""></option>
                      {STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <label>State</label>
                  </div>
                  <div className="field">
                    <input
                      placeholder=" "
                      type="text"
                      value={addrPostcode}
                      onChange={(e) => setAddrPostcode(e.target.value)}
                    />
                    <label>Postcode</label>
                  </div>
                </div>
                <div className="address-form-actions">
                  <button className="submit-btn small" data-ripple="" type="submit" disabled={addrSaving}>
                    {addrSaving ? "Saving…" : "Save Address"}
                  </button>
                  <button
                    className="address-cancel"
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetAddrForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button className="add-address-btn" type="button" onClick={() => setShowAddForm(true)}>
                + Add New Address
              </button>
            )}
          </div>

          <button className="signout-btn" type="button" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      <FullFooter />
    </>
  );
}
