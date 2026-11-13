// Put at: src/utils/handlers/chat/chatLinks.js
// Plain DB functions for the chat_links table. No socket code in here,
// so the same functions can be reused by REST routes or the message handler.

const { db } = require("../../data/database.js");
const logger = require("../../middleware/logger.js");

const fail = (reason) => ({ success: false, reason });
const now = () => new Date().toISOString();

// Matches the pair in either direction (A->B or B->A). Inputs must be integers.
const pairFilter = (a, b) =>
  `and(requester_id.eq.${a},receiver_id.eq.${b}),and(requester_id.eq.${b},receiver_id.eq.${a})`;

const findPair = async (a, b) => {
  const { data, error } = await db
    .from("chat_links")
    .select("*")
    .or(pairFilter(a, b))
    .maybeSingle();
  if (error) throw error;
  return data;
};

const getUserByUsername = async (username) => {
  const { data, error } = await db
    .from("users")
    .select("userId, username")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
};

/* ---------- send a chat request by username ---------- */
const sendRequest = async (me, rawUsername) => {
  try {
    if (!Number.isInteger(me)) return fail("Not authenticated.");
    if (typeof rawUsername !== "string" || !rawUsername.trim()) {
      return fail("Username is required.");
    }

    const target = await getUserByUsername(rawUsername.trim());
    if (!target) return fail("User not found.");
    if (target.userId === me) return fail("You can't add yourself.");

    const existing = await findPair(me, target.userId);

    if (existing) {
      if (existing.status === "accepted") return fail("You are already linked.");
      if (existing.status === "blocked") return fail("Unable to send a request to this user.");
      if (existing.requester_id === me) return fail("Request already sent.");

      // They already requested us -> treat our request as accepting theirs
      const { error } = await db
        .from("chat_links")
        .update({ status: "accepted", updated_at: now() })
        .eq("id", existing.id);
      if (error) throw error;
      return { success: true, linkId: existing.id, status: "accepted", otherUserId: target.userId };
    }

    const { data, error } = await db
      .from("chat_links")
      .insert({ requester_id: me, receiver_id: target.userId })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return fail("Request already exists."); // race condition
      throw error;
    }

    return { success: true, linkId: data.id, status: "pending", otherUserId: target.userId };
  } catch (err) {
    logger.error("[chatLinks.sendRequest] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- accept | decline | block | unblock ---------- */
const respondToLink = async (me, linkId, action) => {
  try {
    if (!Number.isInteger(me)) return fail("Not authenticated.");
    if (!Number.isInteger(linkId)) return fail("Invalid link.");

    const { data: link, error } = await db
      .from("chat_links")
      .select("*")
      .eq("id", linkId)
      .maybeSingle();
    if (error) throw error;

    // Only the two people in the link may touch it
    if (!link || (link.requester_id !== me && link.receiver_id !== me)) {
      return fail("Link not found.");
    }

    const otherUserId = link.requester_id === me ? link.receiver_id : link.requester_id;
    let status;

    if (action === "accept") {
      if (link.receiver_id !== me || link.status !== "pending") return fail("Nothing to accept.");
      const { error: e } = await db
        .from("chat_links")
        .update({ status: "accepted", updated_at: now() })
        .eq("id", linkId);
      if (e) throw e;
      status = "accepted";
    } else if (action === "decline") {
      if (link.receiver_id !== me || link.status !== "pending") return fail("Nothing to decline.");
      const { error: e } = await db.from("chat_links").delete().eq("id", linkId);
      if (e) throw e;
      status = "declined";
    } else if (action === "block") {
      if (link.status === "blocked") return fail("Already blocked.");
      const { error: e } = await db
        .from("chat_links")
        .update({ status: "blocked", blocked_by: me, updated_at: now() })
        .eq("id", linkId);
      if (e) throw e;
      status = "blocked";
    } else if (action === "unblock") {
      // Only the person who blocked can unblock
      if (link.status !== "blocked" || link.blocked_by !== me) return fail("Nothing to unblock.");
      const { error: e } = await db.from("chat_links").delete().eq("id", linkId);
      if (e) throw e;
      status = "unblocked";
    } else {
      return fail("Unknown action.");
    }

    return { success: true, linkId, status, otherUserId };
  } catch (err) {
    logger.error("[chatLinks.respondToLink] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- list my links (with the other user's username) ---------- */
const listLinks = async (me) => {
  try {
    if (!Number.isInteger(me)) return fail("Not authenticated.");

    const { data, error } = await db
      .from("chat_links")
      .select("*")
      .or(`requester_id.eq.${me},receiver_id.eq.${me}`);
    if (error) throw error;

    // Hide links where the OTHER person blocked me
    const visible = data.filter((l) => l.status !== "blocked" || l.blocked_by === me);
    const otherId = (l) => (l.requester_id === me ? l.receiver_id : l.requester_id);
    const ids = [...new Set(visible.map(otherId))];

    let names = {};
    if (ids.length) {
      const { data: users, error: uErr } = await db
        .from("users")
        .select("userId, username")
        .in("userId", ids);
      if (uErr) throw uErr;
      names = Object.fromEntries(users.map((u) => [u.userId, u.username]));
    }

    const links = visible.map((l) => ({
      linkId: l.id,
      status: l.status,
      direction: l.requester_id === me ? "outgoing" : "incoming",
      user: { userId: otherId(l), username: names[otherId(l)] || "" },
    }));

    return { success: true, links };
  } catch (err) {
    logger.error("[chatLinks.listLinks] " + err.message);
    return fail("Internal Server Error");
  }
};

// For the message handler later: may these two users message each other?
const areLinked = async (a, b) => {
  try {
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    const link = await findPair(a, b);
    return !!link && link.status === "accepted";
  } catch (err) {
    logger.error("[chatLinks.areLinked] " + err.message);
    return false;
  }
};

module.exports = { sendRequest, respondToLink, listLinks, areLinked };