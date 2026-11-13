// Put at: src/utils/handlers/chat/messageQueue.js
//
// A mailbox in Redis for messages that haven't been delivered yet.
// Layout: one Redis hash per receiver
//   key   = msgq:<receiverId>
//   field = <senderId>:<clientId>      (the message id)
//   value = JSON of the message
//
// A message lives here only until the receiver's app confirms it got it.

const { cache } = require("../../data/cache.js");
const logger = require("../../middleware/logger.js");

const MAX_TEXT_LENGTH = 2000;                 // characters per message
const MAX_QUEUE_SIZE = 500;                   // undelivered messages per receiver
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // drop anything older than 7 days
const MAX_ACK_BATCH = 100;                    // ids per ack call

const queueKey = (userId) => `msgq:${userId}`;
const fail = (reason) => ({ success: false, reason });

/* ---------- save a message for a receiver ---------- */
const enqueueMessage = async ({ from, fromUsername, to, clientId, text }) => {
  try {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return fail("Invalid users.");

    // clientId is made by the sender's app (e.g. a UUID). It lets retries be detected.
    if (typeof clientId !== "string" || !/^[\w-]{1,64}$/.test(clientId)) {
      return fail("Invalid message id.");
    }

    if (typeof text !== "string" || !text.trim()) return fail("Message is empty.");
    if (text.length > MAX_TEXT_LENGTH) {
      return fail(`Message too long (max ${MAX_TEXT_LENGTH} characters).`);
    }

    const key = queueKey(to);

    // Stop one person's inbox from growing forever
    const size = await cache.hLen(key);
    if (size >= MAX_QUEUE_SIZE) return fail("Recipient's inbox is full.");

    // Prefixing with the sender id means nobody can overwrite another sender's message
    const messageId = `${from}:${clientId}`;
    const message = {
      id: messageId,
      from,
      fromUsername,
      text: text.trim(),
      ts: Date.now(),
    };

    // hSetNX only writes if the field does not exist yet.
    // If it does exist, this is a retry of a message we already have.
    const added = await cache.hSetNX(key, messageId, JSON.stringify(message));
    await cache.expire(key, Math.floor(MAX_AGE_MS / 1000));

    if (!added) return { success: true, duplicate: true, messageId };
    return { success: true, duplicate: false, messageId, message };
  } catch (err) {
    logger.error("[messageQueue.enqueueMessage] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- get everything waiting for a user (oldest first) ---------- */
const getPending = async (userId) => {
  try {
    if (!Number.isInteger(userId)) return fail("Not authenticated.");

    const key = queueKey(userId);
    const raw = await cache.hGetAll(key);

    const cutoff = Date.now() - MAX_AGE_MS;
    const messages = [];
    const staleIds = [];

    for (const [id, json] of Object.entries(raw)) {
      try {
        const msg = JSON.parse(json);
        if (msg.ts < cutoff) staleIds.push(id);
        else messages.push(msg);
      } catch {
        staleIds.push(id); // corrupted entry, remove it
      }
    }

    if (staleIds.length) await cache.hDel(key, staleIds);

    messages.sort((a, b) => a.ts - b.ts);
    return { success: true, messages };
  } catch (err) {
    logger.error("[messageQueue.getPending] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- receiver confirms delivery -> delete from the mailbox ---------- */
const ackMessages = async (userId, ids) => {
  try {
    if (!Number.isInteger(userId)) return fail("Not authenticated.");
    if (!Array.isArray(ids) || ids.length === 0) return fail("No message ids given.");

    const clean = ids
      .filter((id) => typeof id === "string" && id.length <= 80)
      .slice(0, MAX_ACK_BATCH);
    if (clean.length === 0) return fail("No valid message ids.");

    // Only deletes from THIS user's own mailbox, so nobody can ack someone else's mail
    await cache.hDel(queueKey(userId), clean);
    return { success: true, acked: clean.length };
  } catch (err) {
    logger.error("[messageQueue.ackMessages] " + err.message);
    return fail("Internal Server Error");
  }
};

module.exports = { enqueueMessage, getPending, ackMessages };