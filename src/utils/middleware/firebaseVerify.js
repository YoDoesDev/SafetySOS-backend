const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_ADMIN_KEY)
    ),
  });
}

const digits = (s) => String(s || "").replace(/\D/g, "");

/**
 * Verifies a Firebase ID token and confirms it belongs to `phone`
 * via a real phone (OTP) sign-in.
 * Returns { ok: true, uid } or { ok: false, reason }.
 */
const verifyPhoneIdToken = async (idToken, phone) => {
  try {
    if (!idToken || typeof idToken !== "string") {
      return { ok: false, reason: "Verification token missing." };
    }

    const decoded = await admin.auth().verifyIdToken(idToken);

    if (decoded.firebase?.sign_in_provider !== "phone") {
      return { ok: false, reason: "Phone verification required." };
    }

    // Firebase gives E.164 (+91...). The app may send it with or
    // without the country code, so compare digits only.
    const fromToken = digits(decoded.phone_number);
    const fromClient = digits(phone);

    if (
      fromClient.length < 10 ||
      !(fromToken === fromClient || fromToken.endsWith(fromClient))
    ) {
      return { ok: false, reason: "Phone number does not match verification." };
    }

    return { ok: true, uid: decoded.uid };
  } catch (err) {
    return { ok: false, reason: "Invalid or expired verification." };
  }
};

module.exports = { verifyPhoneIdToken };
