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
  // Firebase console in this build — only price is live-editable by admin
  // via the "products" collection, so the storefront stays wired to real data
  // without needing a full product-editor UI).
  var STATIC_PRODUCTS = {
    "bar-1kg":  { name: "1 Kilo Investment Bar", tag: "Signature Bar",      purity: "999.9", price: 537893, img: "image/gold_1kg.png",  w: 52 },
    "bar-100g": { name: "100 GM Wholesale Bar",  tag: "Best Seller",        purity: "999.9", price: 53832,  img: "image/gold_100g.png", w: 56 },
    "bar-50g":  { name: "50 GM Gold Bar",        tag: "Popular Choice",     purity: "999.9", price: 26929,  img: "image/gold_50g.png",  w: 50 },
    "bar-10g":  { name: "10 GM Gift Bar",        tag: "Starter Collection", purity: "999.9", price: 5579,   img: "image/gold_10g.png",  w: 40 },
    "bar-1g":   { name: "1 GM Gold Bar",         tag: "Entry Collection",   purity: "999.9", price: 559,    img: "image/gold_1g.png",   w: 24 }
  };

  var currentUser = null;
  var productsCache = null;

  // ------------------------------------------------------------------ auth
  function onAuthChange(cb) {
    return auth.onAuthStateChanged(function (user) {
      currentUser = user;
      if (user) migrateGuestCartToUser(user.uid);
      cb(user);
    });
  }

  function isAdmin(user) {
    user = user || currentUser;
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.map(function (e) { return e.toLowerCase(); })
      .indexOf(user.email.toLowerCase()) !== -1;
  }

  function register(data) {
    return auth.createUserWithEmailAndPassword(data.email, data.password)
      .then(function (cred) {
        return cred.user.updateProfile({ displayName: data.name }).then(function () {
          return db.collection("users").doc(cred.user.uid).set({
            name: data.name,
            email: data.email,
            phone: data.phone || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }).then(function () { return cred.user; });
      });
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
    return ref.get().then(function (doc) {
      if (doc.exists) return user;
      return ref.set({
        name: user.displayName || "",
        email: user.email || "",
        phone: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).then(function () { return user; });
    });
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

  // ------------------------------------------------------------- products
  function getProducts() {
    if (productsCache) return Promise.resolve(productsCache);
    return db.collection("products").get().then(function (snap) {
      var merged = {};
      Object.keys(STATIC_PRODUCTS).forEach(function (id) {
        merged[id] = Object.assign({}, STATIC_PRODUCTS[id]);
      });
      snap.forEach(function (doc) {
        if (merged[doc.id]) Object.assign(merged[doc.id], doc.data());
      });
      productsCache = merged;
      return merged;
    }).catch(function () {
      // Firestore not reachable/configured yet — fall back to static prices
      // so the storefront still works while Firebase is being set up.
      productsCache = STATIC_PRODUCTS;
      return STATIC_PRODUCTS;
    });
  }

  function updateProductPrice(id, price) {
    return db.collection("products").doc(id).set({ price: price }, { merge: true })
      .then(function () { productsCache = null; });
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
    return db.collection("users").doc(currentUser.uid).get().then(function (doc) {
      var data = doc.data();
      return (data && Array.isArray(data.cart)) ? data.cart : [];
    }).catch(function () { return readGuestCart(); });
  }

  function writeCart(cart) {
    if (!currentUser) { writeGuestCart(cart); return Promise.resolve(); }
    return db.collection("users").doc(currentUser.uid)
      .set({ cart: cart }, { merge: true });
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
    return readCart().then(function (cart) {
      var line = cart.find(function (l) { return l.id === id; });
      if (line) line.qty = Math.max(1, Math.min(99, line.qty + qty));
      else cart.push({ id: id, qty: qty });
      return writeCart(cart).then(function () { return cart; });
    });
  }

  function changeQty(id, delta) {
    return readCart().then(function (cart) {
      var line = cart.find(function (l) { return l.id === id; });
      if (!line) return cart;
      line.qty = Math.max(1, Math.min(99, line.qty + delta));
      return writeCart(cart).then(function () { return cart; });
    });
  }

  function removeFromCart(id) {
    return readCart().then(function (cart) {
      var next = cart.filter(function (l) { return l.id !== id; });
      return writeCart(next).then(function () { return next; });
    });
  }

  function clearCart() { return writeCart([]); }

  // ---------------------------------------------------------------- orders
  function generateOrderId() {
    var d = new Date();
    var rand = Math.floor(100000 + Math.random() * 900000);
    return "GBA-" + d.getFullYear() + "-" + rand;
  }

  function createOrder(order) {
    var id = generateOrderId();
    order.id = id;
    order.userId = currentUser ? currentUser.uid : null;
    order.status = order.status || "pending";
    order.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("orders").doc(id).set(order).then(function () { return id; });
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
    getProducts: getProducts,
    updateProductPrice: updateProductPrice,
    fmtRM: fmtRM,
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
    logs: { add: addLog, listen: listenLogs },
    settings: { listen: listenSettings, update: updateSettings }
  };
})();
