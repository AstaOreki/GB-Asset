/* ==========================================================================
   GB ASSET — Firebase data layer
   Loaded after firebase-app/auth/firestore compat SDKs + firebase-config.js
   Exposes everything through window.GBA so existing page scripts can call it
   without changing any markup/CSS.
   ========================================================================== */
(function () {
  "use strict";

  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var CART_KEY = "gba_cart_v1"; // same key the pages already used for guests

  // Static product catalogue (names/images/weights never change from the
  // Firebase console in this build — only pricing is live-editable by admin
  // via the "products" collection, so the storefront stays wired to real data
  // without needing a full product-editor UI). Each bar carries its own
  // buyPrice/sellPrice as the TOTAL price for that bar (not per-gram —
  // bulk bars carry a different premium than small ones, and this is what
  // admins actually enter and what every other consumer, MKS PAMP's own
  // reference table included, quotes). `price` mirrors sellPrice, kept as
  // its own field since cart/checkout/create-order already read a flat
  // per-unit price. buyPrice defaults to sellPrice (margin 0) here only as
  // a placeholder until the admin enters a real buy price.
  var STATIC_PRODUCTS = {
    "bar-1kg":  { name: "1 Kilo Gold Bar", tag: "Signature Bar",      purity: "999.9", grams: 1000, sellPrice: 537893, buyPrice: 537893, margin: 0, price: 537893, img: "image/gold_1kg.png",  w: 52 },
    "bar-250g": { name: "250 GM Gold Bar",       tag: "Investor Bar",       purity: "999.9", grams: 250,  sellPrice: 134525, buyPrice: 134525, margin: 0, price: 134525, img: "image/gold_100g.png", w: 56 },
    "bar-100g": { name: "100 GM Wholesale Bar",  tag: "Best Seller",        purity: "999.9", grams: 100,  sellPrice: 53832,  buyPrice: 53832,  margin: 0, price: 53832,  img: "image/gold_100g.png", w: 56 },
    "bar-50g":  { name: "50 GM Gold Bar",        tag: "Popular Choice",     purity: "999.9", grams: 50,   sellPrice: 26929,  buyPrice: 26929,  margin: 0, price: 26929,  img: "image/gold_50g.png",  w: 50 },
    "bar-20g":  { name: "20 GM Gold Bar",        tag: "Everyday Bar",       purity: "999.9", grams: 20,   sellPrice: 11040,  buyPrice: 11040,  margin: 0, price: 11040,  img: "image/gold_50g.png",  w: 46 },
    "bar-10g":  { name: "10 GM Gift Bar",        tag: "Starter Collection", purity: "999.9", grams: 10,   sellPrice: 5579,   buyPrice: 5579,   margin: 0, price: 5579,   img: "image/gold_10g.png",  w: 40 },
    "bar-5g":   { name: "5 GM Gold Bar",         tag: "Gift Collection",    purity: "999.9", grams: 5,    sellPrice: 2792,   buyPrice: 2792,   margin: 0, price: 2792,   img: "image/gold_10g.png",  w: 32 },
    "bar-1g":   { name: "1 GM Gold Bar",         tag: "Entry Collection",   purity: "999.9", grams: 1,    sellPrice: 559,    buyPrice: 559,    margin: 0, price: 559,    img: "image/gold_1g.png",   w: 24 }
  };

  var currentUser = null;
  var productsCache = null;
  // Tracks an in-flight guest-cart merge (see migrateGuestCartToUser) so
  // readCart() can wait for it — currentUser is set synchronously below,
  // before the merge's Firestore write finishes, so any cart read that
  // fires right after sign-in (e.g. checkout's product-load effect) needs
  // this to avoid reading the doc before the merge has landed.
  var pendingCartMigration = null;

  // Tracks an in-flight registration/Google-first-sign-in profile write
  // (displayName + the users/{uid} doc). auth.onAuthStateChanged fires the
  // instant the account is created/authenticated — well before
  // register()'s updateProfile()+Firestore .set() finish — so any page
  // subscribed via onAuthChange (e.g. /login's "already signed in, redirect
  // away" effect) could navigate away and abort that write before it lands,
  // leaving the new user with no profile doc at all. onAuthChange() below
  // waits for this, same as it already does for pendingCartMigration.
  var pendingProfileSetup = null;

  function trackProfileSetup(promise) {
    var tracked = promise.catch(function () {}).then(function () {
      if (pendingProfileSetup === tracked) pendingProfileSetup = null;
    });
    pendingProfileSetup = tracked;
    return promise;
  }

  // ------------------------------------------------------------------ auth
  // A single internal listener drives currentUser + the guest-cart merge
  // exactly once per real sign-in. onAuthChange(cb) below is called by
  // several independent components (header, checkout, etc.) — each used to
  // register its own auth.onAuthStateChanged listener that ALSO kicked off
  // its own migrateGuestCartToUser call, so one sign-in fired 2-3 redundant
  // concurrent migrations (each its own Firestore read+write round trip),
  // which was slow enough that pages reading the cart right after sign-in
  // would see it still empty. Migration now only ever runs here, once.
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      pendingCartMigration = migrateGuestCartToUser(user.uid).then(function () {
        pendingCartMigration = null;
      });
    } else {
      pendingCartMigration = null;
    }
  });

  function onAuthChange(cb) {
    return auth.onAuthStateChanged(function (user) {
      if (user) {
        Promise.resolve(pendingCartMigration)
          .then(function () { return Promise.resolve(pendingProfileSetup); })
          .then(function () { cb(user); });
      } else {
        cb(user);
      }
    });
  }

  function isAdmin(user) {
    user = user || currentUser;
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.map(function (e) { return e.toLowerCase(); })
      .indexOf(user.email.toLowerCase()) !== -1;
  }

  function register(data) {
    return trackProfileSetup(
      auth.createUserWithEmailAndPassword(data.email, data.password)
        .then(function (cred) {
          return cred.user.updateProfile({ displayName: data.name }).then(function () {
            return db.collection("users").doc(cred.user.uid).set({
              name: data.name,
              email: data.email,
              phone: data.phone || "",
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }).then(function () { return cred.user; });
        })
    );
  }

  function login(data) {
    var persistence = data.remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    return auth.setPersistence(persistence).then(function () {
      return auth.signInWithEmailAndPassword(data.email, data.password);
    }).then(function (cred) { return cred.user; });
  }

  // Mobile browsers (iOS Safari, in-app browsers, many Android browsers)
  // routinely block window.open()-based popups once any async gap (like
  // setPersistence's promise) separates the click from the popup call —
  // this is what caused "Your browser blocked the sign-in popup" on
  // phones. Redirect-based sign-in sidesteps popups entirely and is what
  // Firebase recommends for mobile.
  function isLikelyToBlockPopups() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function finishGoogleSignIn(user) {
    var ref = db.collection("users").doc(user.uid);
    return trackProfileSetup(
      ref.get().then(function (doc) {
        if (doc.exists) return user;
        return ref.set({
          name: user.displayName || "",
          email: user.email || "",
          phone: "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(function () { return user; });
      })
    );
  }

  function loginWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function () {
      if (isLikelyToBlockPopups()) {
        // Navigates the whole page to Google and back — the caller never
        // sees this promise resolve. The page that receives the redirect
        // back must call GBA.checkGoogleRedirectResult() on mount instead.
        return auth.signInWithRedirect(provider);
      }
      return auth.signInWithPopup(provider).then(function (cred) {
        return finishGoogleSignIn(cred.user);
      });
    });
  }

  // Call on mount of any page that offers Google sign-in, so the mobile
  // signInWithRedirect flow above has somewhere to land. Resolves to the
  // signed-in user if the page was just reached via a redirect-based
  // Google sign-in, or null if there's no pending redirect (the normal
  // case for every other page load).
  function checkGoogleRedirectResult() {
    return auth.getRedirectResult().then(function (result) {
      if (!result || !result.user) return null;
      return finishGoogleSignIn(result.user);
    });
  }

  function logout() { return auth.signOut(); }

  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }

  // --------------------------------------------------------------- profile
  function hasPasswordProvider() {
    return !!(currentUser && currentUser.providerData.some(function (p) { return p.providerId === "password"; }));
  }

  function getProfile() {
    if (!currentUser) return Promise.resolve(null);
    return db.collection("users").doc(currentUser.uid).get().then(function (doc) {
      var data = doc.data() || {};
      return {
        name: currentUser.displayName || data.name || "",
        email: currentUser.email || data.email || "",
        phone: data.phone || "",
        addresses: Array.isArray(data.addresses) ? data.addresses : []
      };
    });
  }

  function updateProfileName(name) {
    if (!currentUser) return Promise.reject(new Error("Not signed in."));
    return currentUser.updateProfile({ displayName: name }).then(function () {
      return db.collection("users").doc(currentUser.uid).set({ name: name }, { merge: true });
    });
  }

  // Re-authentication is required by Firebase before a sensitive op like
  // updatePassword() — without it, updatePassword fails with
  // auth/requires-recent-login unless the user signed in within the last
  // few minutes.
  function changePassword(currentPassword, newPassword) {
    if (!currentUser || !currentUser.email) return Promise.reject(new Error("Not signed in."));
    var cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
    return currentUser.reauthenticateWithCredential(cred).then(function () {
      return currentUser.updatePassword(newPassword);
    });
  }

  function listAddresses() {
    if (!currentUser) return Promise.resolve([]);
    return db.collection("users").doc(currentUser.uid).get().then(function (doc) {
      var data = doc.data();
      return (data && Array.isArray(data.addresses)) ? data.addresses : [];
    });
  }

  // Same read-modify-write race the cart queue below already guards
  // against: two overlapping add/remove calls (e.g. two open tabs) could
  // both read the same starting addresses array before either write
  // lands, so the second write would silently clobber the first based on
  // stale data. Chaining every mutation off this one promise forces them
  // to run one at a time.
  var addressOpQueue = Promise.resolve();
  function queueAddressOp(fn) {
    var result = addressOpQueue.then(fn, fn);
    addressOpQueue = result.then(function () {}, function () {});
    return result;
  }

  function addAddress(addr) {
    if (!currentUser) return Promise.reject(new Error("Not signed in."));
    return queueAddressOp(function () {
      var ref = db.collection("users").doc(currentUser.uid);
      return ref.get().then(function (doc) {
        var data = doc.data() || {};
        var addresses = Array.isArray(data.addresses) ? data.addresses.slice() : [];
        var entry = Object.assign({ id: "addr_" + Date.now() }, addr);
        addresses.push(entry);
        return ref.set({ addresses: addresses }, { merge: true }).then(function () { return entry; });
      });
    });
  }

  function removeAddress(id) {
    if (!currentUser) return Promise.reject(new Error("Not signed in."));
    return queueAddressOp(function () {
      var ref = db.collection("users").doc(currentUser.uid);
      return ref.get().then(function (doc) {
        var data = doc.data() || {};
        var addresses = (Array.isArray(data.addresses) ? data.addresses : []).filter(function (a) { return a.id !== id; });
        return ref.set({ addresses: addresses }, { merge: true });
      });
    });
  }

  // ------------------------------------------------------------- products
  // A Firestore products/{id} doc may only carry buyPrice/sellPrice
  // (written by updateProductRate below) — derive price/margin from those
  // so every reader sees consistent numbers without each caller
  // re-deriving it. Both are the bar's TOTAL price, not per-gram.
  function deriveProductPricing(product) {
    if (typeof product.sellPrice === "number") {
      product.price = product.sellPrice;
    }
    if (typeof product.sellPrice === "number" && typeof product.buyPrice === "number") {
      product.margin = Math.round((product.sellPrice - product.buyPrice) * 100) / 100;
    }
    return product;
  }

  function mergeProducts(snap) {
    var merged = {};
    Object.keys(STATIC_PRODUCTS).forEach(function (id) {
      merged[id] = Object.assign({}, STATIC_PRODUCTS[id]);
    });
    snap.forEach(function (doc) {
      if (merged[doc.id]) deriveProductPricing(Object.assign(merged[doc.id], doc.data()));
    });
    return merged;
  }

  function getProducts() {
    if (productsCache) return Promise.resolve(productsCache);
    var fetchPromise = db.collection("products").get().then(function (snap) {
      var merged = mergeProducts(snap);
      productsCache = merged;
      return merged;
    }).catch(function () {
      // Firestore not reachable/configured yet — fall back to static prices
      // so the storefront still works while Firebase is being set up.
      productsCache = STATIC_PRODUCTS;
      return STATIC_PRODUCTS;
    });
    // A stalled connection can leave fetchPromise neither resolved nor
    // rejected (the .catch() above only helps once it actually fails), so
    // every page waiting on this — cart, checkout, home — would hang
    // indefinitely with no error and no way for the user to tell if it's
    // slow or broken. Race a timeout so a hang degrades to the static
    // catalog instead of blocking forever; fetchPromise keeps running in
    // the background and still updates productsCache if it eventually lands.
    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () { resolve(STATIC_PRODUCTS); }, 6000);
    });
    return Promise.race([fetchPromise, timeoutPromise]);
  }

  // Realtime feed for the storefront so an admin's price update shows up on
  // an already-open homepage without a refresh.
  function listenProducts(cb) {
    return db.collection("products").onSnapshot(function (snap) {
      var merged = mergeProducts(snap);
      productsCache = merged;
      cb(merged);
    }, function () { cb(STATIC_PRODUCTS); });
  }

  // buyPrice/sellPrice are the bar's TOTAL price (what the admin actually
  // types, matching every other price shown on the site) — not per-gram.
  function updateProductRate(id, buyPrice, sellPrice) {
    var grams = STATIC_PRODUCTS[id] && STATIC_PRODUCTS[id].grams;
    var name = STATIC_PRODUCTS[id] && STATIC_PRODUCTS[id].name;
    var margin = Math.round((sellPrice - buyPrice) * 100) / 100;
    return db.collection("products").doc(id).set({
      buyPrice: buyPrice, sellPrice: sellPrice, margin: margin, price: sellPrice,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      productsCache = null;
      // Two writes, on purpose:
      //   priceHistory — today's doc for this bar, overwritten if the admin
      //     saves again today, so it always holds the day's latest price.
      //   priceUpdates — a new immutable doc every single time, so no save
      //     is ever lost even when several land on the same day.
      // The audit append must not be able to silently fail while the daily
      // record succeeds, so both are awaited together.
      return Promise.all([
        upsertPriceRecord(id, sellPrice, buyPrice, grams, name),
        appendPriceUpdate(id, sellPrice, buyPrice, grams, name)
      ]).then(function (r) { return r[0]; });
    });
  }

  // ------------------------------------------------------------------ cart
  function readGuestCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function writeGuestCart(cart) {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }

  function readCart() {
    if (!currentUser) return Promise.resolve(readGuestCart());
    return Promise.resolve(pendingCartMigration).then(function () {
      return db.collection("users").doc(currentUser.uid).get();
    }).then(function (doc) {
      var data = doc.data();
      return (data && Array.isArray(data.cart)) ? data.cart : [];
    }).catch(function () { return readGuestCart(); });
  }

  function writeCart(cart) {
    if (!currentUser) { writeGuestCart(cart); return Promise.resolve(); }
    return db.collection("users").doc(currentUser.uid)
      .set({ cart: cart }, { merge: true });
  }

  // addToCart/changeQty/removeFromCart/clearCart all read the cart then
  // write it back — without this queue, two overlapping calls (e.g. a
  // fast double-click on the qty stepper) could both read the same
  // starting cart before either write landed, so the second write would
  // silently clobber the first based on stale data. Chaining every
  // mutation off this single promise forces them to run one at a time.
  var cartOpQueue = Promise.resolve();
  function queueCartOp(fn) {
    var result = cartOpQueue.then(fn, fn);
    cartOpQueue = result.then(function () {}, function () {});
    return result;
  }

  function migrateGuestCartToUser(uid) {
    var guest = readGuestCart();
    if (!guest.length) return Promise.resolve();
    var ref = db.collection("users").doc(uid);
    return ref.get().then(function (doc) {
      var existing = (doc.data() && doc.data().cart) || [];
      var merged = existing.slice();
      guest.forEach(function (line) {
        var found = merged.find(function (l) { return l.id === line.id; });
        if (found) found.qty = Math.min(99, found.qty + line.qty);
        else merged.push(line);
      });
      return ref.set({ cart: merged }, { merge: true });
    }).then(function () {
      writeGuestCart([]);
    }).catch(function () {});
  }

  function cartCount(cart) {
    return cart.reduce(function (sum, l) { return sum + (l && l.qty > 0 ? l.qty : 0); }, 0);
  }

  function cartSubtotal(cart, products) {
    return cart.reduce(function (sum, l) {
      var p = products[l.id];
      return sum + (p ? p.price * l.qty : 0);
    }, 0);
  }

  function addToCart(id, qty) {
    qty = qty || 1;
    return queueCartOp(function () {
      return readCart().then(function (cart) {
        var line = cart.find(function (l) { return l.id === id; });
        if (line) line.qty = Math.max(1, Math.min(99, line.qty + qty));
        else cart.push({ id: id, qty: qty });
        return writeCart(cart).then(function () { return cart; });
      });
    });
  }

  function changeQty(id, delta) {
    return queueCartOp(function () {
      return readCart().then(function (cart) {
        var line = cart.find(function (l) { return l.id === id; });
        if (!line) return cart;
        line.qty = Math.max(1, Math.min(99, line.qty + delta));
        return writeCart(cart).then(function () { return cart; });
      });
    });
  }

  function removeFromCart(id) {
    return queueCartOp(function () {
      return readCart().then(function (cart) {
        var next = cart.filter(function (l) { return l.id !== id; });
        return writeCart(next).then(function () { return next; });
      });
    });
  }

  function clearCart() { return queueCartOp(function () { return writeCart([]); }); }

  // ---------------------------------------------------------------- orders
  function generateOrderId() {
    var d = new Date();
    var rand = Math.floor(100000 + Math.random() * 900000);
    return "GBA-" + d.getFullYear() + "-" + rand;
  }

  // generateOrderId() is a 6-digit random suffix — collisions are rare but
  // not impossible, and .set() on an existing doc silently overwrites it
  // rather than erroring. Retry on the rare collision instead of risking a
  // clobbered order, mirroring app/api/create-order's server-side retry.
  function createOrder(order) {
    order.userId = currentUser ? currentUser.uid : null;
    order.status = order.status || "pending";
    order.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    function attempt(triesLeft) {
      var id = generateOrderId();
      var ref = db.collection("orders").doc(id);
      return ref.get().then(function (doc) {
        if (doc.exists) {
          if (triesLeft <= 1) return Promise.reject(new Error("Could not generate a unique order ID, please try again."));
          return attempt(triesLeft - 1);
        }
        order.id = id;
        return ref.set(order).then(function () { return id; });
      });
    }
    return attempt(5);
  }

  function listenOrders(cb) {
    return db.collection("orders").orderBy("createdAt", "desc")
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) { out.push(doc.data()); });
        cb(out);
      }, function () { cb([]); });
  }

  function updateOrderStatus(id, status) {
    return db.collection("orders").doc(id).update({ status: status });
  }

  function deleteOrder(id) { return db.collection("orders").doc(id).delete(); }

  // --------------------------------------------------------- consultations
  function submitConsultation(data) {
    data.status = "new";
    data.assignedTo = "";
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("consultations").add(data);
  }

  function listenConsultations(cb) {
    return db.collection("consultations").orderBy("createdAt", "desc")
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) { out.push(Object.assign({ docId: doc.id }, doc.data())); });
        cb(out);
      }, function () { cb([]); });
  }

  function updateConsultation(docId, patch) {
    return db.collection("consultations").doc(docId).update(patch);
  }

  function deleteConsultation(docId) {
    return db.collection("consultations").doc(docId).delete();
  }

  // --------------------------------------------------------- announcements
  function publishAnnouncement(data) {
    data.views = 0;
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("announcements").add(data);
  }

  function listenAnnouncements(cb) {
    return db.collection("announcements").orderBy("createdAt", "desc")
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) { out.push(Object.assign({ docId: doc.id }, doc.data())); });
        cb(out);
      }, function () { cb([]); });
  }

  function deleteAnnouncement(docId) {
    return db.collection("announcements").doc(docId).delete();
  }

  // ---------------------------------------------------------- priceHistory
  // "1d" starts at the beginning of YESTERDAY, not today. Each bar only
  // gets one upserted record per calendar day, so a since-midnight-today
  // window can hold at most one point — never the two a trend line needs,
  // which left the 1 Day chart permanently stuck on "not enough data".
  // Starting a day earlier plots yesterday -> today, which is exactly what
  // a one-day movement chart should show anyway. The others are rolling
  // windows, per the Price Today spec.
  function rangeStartDate(rangeKey) {
    var now = new Date();
    if (rangeKey === "1d") {
      var startOfYesterday = new Date(now);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      startOfYesterday.setHours(0, 0, 0, 0);
      return startOfYesterday;
    }
    var d = new Date(now);
    if (rangeKey === "1m") d.setDate(d.getDate() - 30);
    else if (rangeKey === "6m") d.setMonth(d.getMonth() - 6);
    else if (rangeKey === "1y") d.setFullYear(d.getFullYear() - 1);
    else d.setDate(d.getDate() - 7); // "1w" and unknown keys fall back to a week
    return d;
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  // Every calendar day in this system is a MALAYSIA day (UTC+8), not the
  // viewer's day. Without this a customer in London loading the site at
  // 20:00 their time sees "today" as the previous date, and an admin
  // saving at 01:00 MYT would have filed it under the day before. Shift
  // the instant into UTC+8 and then read the ordinary local getters off
  // the shifted Date.
  var MY_OFFSET_MS = 8 * 60 * 60 * 1000;
  function toMY(d) {
    var t = (d instanceof Date ? d : new Date(d));
    return new Date(t.getTime() + t.getTimezoneOffset() * 60000 + MY_OFFSET_MS);
  }
  function dateKeyFor(d) {
    var m = toMY(d);
    return m.getFullYear() + "-" + pad2(m.getMonth() + 1) + "-" + pad2(m.getDate());
  }
  function todayKey() { return dateKeyFor(new Date()); }
  // Shift a MY date key by n days, staying on date keys so the result can
  // never drift across a DST boundary of the viewer's own zone.
  function shiftKey(key, days) {
    var p = key.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  // One doc per bar per calendar day (id "{productId}_{YYYY-MM-DD}"),
  // upserted — saving the same bar again the same day overwrites that
  // day's entry instead of piling up duplicate rows ("a fixed price the
  // admin can change anytime", not a log entry per click). A new calendar
  // day gets its own doc, which is what preserves day-by-day history for
  // the 1W/1M/6M/1Y filters and what "resets daily" means here: nothing
  // is deleted, today's edits just land in today's doc.
  function upsertPriceRecord(productId, sell, buy, weight, productName) {
    var margin = Math.round((sell - buy) * 100) / 100;
    var dateKey = todayKey();
    var docId = productId + "_" + dateKey;
    return db.collection("priceHistory").doc(docId).set({
      sell: sell, buy: buy, margin: margin, weight: weight, productName: productName || "",
      productId: productId, date: dateKey,
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { return docId; });
  }

  // The permanent audit trail: one APPENDED doc per save, auto-id, never
  // updated and never deletable (enforced in firestore.rules). Save the
  // same bar five times today and five docs exist forever.
  //
  // This is deliberately separate from priceHistory above, which keeps one
  // doc per bar per day holding that day's LATEST price — the daily layer
  // the calendar and graph read. Together: priceUpdates answers "every
  // change ever made", priceHistory answers "what was the price on day X".
  // Carried-forward days are never written to either; they are derived at
  // read time, so a gap in the data stays a gap in the data.
  function appendPriceUpdate(productId, sell, buy, weight, productName) {
    var margin = Math.round((sell - buy) * 100) / 100;
    return db.collection("priceUpdates").add({
      productId: productId,
      productName: productName || "",
      weight: weight,
      sell: sell,
      buy: buy,
      margin: margin,
      // Stored so the calendar/compare never has to re-derive it, and so a
      // later change to bar weights can't retroactively alter old records.
      pricePerGram: weight > 0 ? Math.round((sell / weight) * 100) / 100 : 0,
      date: todayKey(),
      updatedBy: (currentUser && (currentUser.email || currentUser.uid)) || "unknown",
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // cb(records) on every update, newest first. errCb (if given) is called
  // instead of cb([]) on a query error, so callers can show a real error
  // state rather than an indistinguishable empty one.
  // Capped so the read cost can't grow without bound as history builds up:
  // "1 Year" across 5 bars would otherwise be ~1,800 docs fetched by every
  // visitor on every range switch. 400 is the most recent ~80 days of all
  // five bars, and the chart only plots one weight at a time, so it has
  // far more points than it can usefully draw.
  function listenPriceHistory(rangeKey, cb, errCb) {
    return db.collection("priceHistory")
      .where("recordedAt", ">=", rangeStartDate(rangeKey))
      .orderBy("recordedAt", "desc")
      .limit(400)
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          out.push(Object.assign({ docId: doc.id }, doc.data({ serverTimestamps: "estimate" })));
        });
        cb(out);
      }, function (err) { if (errCb) errCb(err); else cb([]); });
  }

  // How many daily docs to pull for each view. One doc per bar per day, so
  // 5 bars x N days. Generous enough that the carry-forward walk always
  // has a record from BEFORE the window to seed itself with — without one,
  // a month where the admin never saved would render blank instead of
  // carrying the previous price in.
  var HISTORY_LIMITS = { "1d": 200, "1w": 300, "1m": 500, "6m": 1500, "1y": 2500, calendar: 900 };

  /**
   * Every daily record on or before `endKey`, newest first.
   *
   * Deliberately NOT filtered to the start of the window: the consumer
   * needs the most recent record before it too, or a period with no saves
   * of its own has nothing to carry forward from. Filtering and the
   * carry-forward walk both happen in lib/priceSeries.js.
   *
   * Ordered by the `date` string rather than `recordedAt` so the ordering
   * matches the Malaysia calendar day the record belongs to.
   */
  function listenDailyHistory(endKey, limitN, cb, errCb) {
    return db.collection("priceHistory")
      .where("date", "<=", endKey)
      .orderBy("date", "desc")
      .limit(limitN || 500)
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          out.push(Object.assign({ docId: doc.id }, doc.data({ serverTimestamps: "estimate" })));
        });
        cb(out);
      }, function (err) { if (errCb) errCb(err); else cb([]); });
  }

  // The raw immutable audit trail, newest first — every save ever made,
  // including several on the same day. Powers the admin's update history.
  function listenPriceUpdates(limitN, cb, errCb) {
    return db.collection("priceUpdates")
      .orderBy("recordedAt", "desc")
      .limit(limitN || 100)
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          out.push(Object.assign({ docId: doc.id }, doc.data({ serverTimestamps: "estimate" })));
        });
        cb(out);
      }, function (err) { if (errCb) errCb(err); else cb([]); });
  }

  // cb(record|null) — whichever bar was most recently saved, and when.
  function listenLatestPriceRecord(cb) {
    return db.collection("priceHistory").orderBy("recordedAt", "desc").limit(1)
      .onSnapshot(function (snap) {
        cb(snap.empty ? null : Object.assign({ docId: snap.docs[0].id }, snap.docs[0].data({ serverTimestamps: "estimate" })));
      }, function () { cb(null); });
  }

  // cb(records) — the current price for every bar, in the row shape the
  // Price Today table/stats expect.
  //
  // Reads `products` rather than priceHistory: every save writes the
  // bar's current buyPrice/sellPrice there, so it is already the
  // authoritative "current rate" and is exactly 5 docs. The old version
  // scanned the 50 most recent priceHistory docs and kept the newest per
  // bar, which meant a bar left untouched while the others updated daily
  // fell out of the window and vanished from the table and stats
  // entirely — silently, since a missing bar looks the same as one that
  // never had a price.
  function listenCurrentRates(cb) {
    return db.collection("products").onSnapshot(function (snap) {
      var merged = mergeProducts(snap);
      // Which bars actually have a saved doc — the rest fall back to the
      // static catalogue price, which callers shouldn't present as a
      // real, admin-set rate.
      var saved = {};
      snap.forEach(function (doc) { saved[doc.id] = true; });
      cb(Object.keys(merged).map(function (id) {
        var p = merged[id];
        return {
          docId: id,
          productId: id,
          productName: p.name,
          weight: p.grams,
          sell: p.sellPrice,
          buy: p.buyPrice,
          margin: p.margin,
          recordedAt: p.updatedAt || null,
          hasRecord: !!saved[id]
        };
      }));
    }, function () { cb([]); });
  }

  // ----------------------------------------------------------------- logs
  function addLog(actor, action, detail, status) {
    return db.collection("logs").add({
      actor: actor, action: action, detail: detail || "",
      status: status || "SUCCESS",
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function listenLogs(cb) {
    return db.collection("logs").orderBy("ts", "desc").limit(200)
      .onSnapshot(function (snap) {
        var out = [];
        snap.forEach(function (doc) { out.push(doc.data()); });
        cb(out);
      }, function () { cb([]); });
  }

  // -------------------------------------------------------------- settings
  function listenSettings(cb) {
    return db.collection("settings").doc("system").onSnapshot(function (doc) {
      cb(doc.data() || { systemMode: false, marketLink: true });
    }, function () { cb({ systemMode: false, marketLink: true }); });
  }

  function updateSettings(patch) {
    return db.collection("settings").doc("system").set(patch, { merge: true });
  }

  function fmtRM(n) { return "RM " + Math.round(n).toLocaleString("en-MY"); }

  // Margin as % markup over the buy price (how much was added over cost),
  // not % of sell price (gross margin) — shown everywhere margin appears
  // instead of a flat RM amount.
  function fmtMarginPercent(sell, buy) {
    if (!(buy > 0)) return "—";
    return (((sell - buy) / buy) * 100).toFixed(2) + "%";
  }

  function fmtDate(ts) {
    var d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  }

  function fmtDateTime(ts) {
    var d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  }

  window.GBA = {
    auth: auth,
    db: db,
    getCurrentUser: function () { return currentUser; },
    onAuthChange: onAuthChange,
    isAdmin: isAdmin,
    register: register,
    login: login,
    loginWithGoogle: loginWithGoogle,
    checkGoogleRedirectResult: checkGoogleRedirectResult,
    logout: logout,
    resetPassword: resetPassword,
    profile: {
      get: getProfile,
      updateName: updateProfileName,
      changePassword: changePassword,
      hasPasswordProvider: hasPasswordProvider,
      addresses: {
        list: listAddresses,
        add: addAddress,
        remove: removeAddress
      }
    },
    getProducts: getProducts,
    listenProducts: listenProducts,
    updateProductRate: updateProductRate,
    fmtRM: fmtRM,
    fmtMarginPercent: fmtMarginPercent,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    cart: {
      read: readCart,
      write: writeCart,
      add: addToCart,
      changeQty: changeQty,
      remove: removeFromCart,
      clear: clearCart,
      count: cartCount,
      subtotal: cartSubtotal
    },
    orders: {
      create: createOrder,
      listen: listenOrders,
      updateStatus: updateOrderStatus,
      remove: deleteOrder
    },
    consultations: {
      submit: submitConsultation,
      listen: listenConsultations,
      update: updateConsultation,
      remove: deleteConsultation
    },
    announcements: {
      publish: publishAnnouncement,
      listen: listenAnnouncements,
      remove: deleteAnnouncement
    },
    priceHistory: {
      listen: listenPriceHistory,
      listenLatest: listenLatestPriceRecord,
      listenCurrent: listenCurrentRates,
      listenDaily: listenDailyHistory,
      listenUpdates: listenPriceUpdates,
      limits: HISTORY_LIMITS,
      todayKey: todayKey,
      dateKeyFor: dateKeyFor,
      shiftKey: shiftKey
    },
    logs: { add: addLog, listen: listenLogs },
    settings: { listen: listenSettings, update: updateSettings }
  };
})();
