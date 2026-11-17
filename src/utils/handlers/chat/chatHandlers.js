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
// Keep a short-lived status record after mailbox delivery so the sender can
// learn whether a message was delivered/read, including after reconnecting.
const statusKey = (senderId) => `msgstatus:${senderId}`;
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
    await cache.hSet(statusKey(from), messageId, JSON.stringify({
      to,
      clientId,
      status: 1, // accepted by the server
      updatedAt: Date.now(),
    }));
    await cache.expire(statusKey(from), Math.floor(MAX_AGE_MS / 1000));
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

    // Only acknowledge messages addressed to this user's mailbox. Update the
    // sender-owned status record before removing the mailbox entry.
    const delivered = [];
    for (const id of clean) {
      const senderId = Number(id.split(":", 1)[0]);
      if (!Number.isInteger(senderId)) continue;
      const raw = await cache.hGet(statusKey(senderId), id);
      if (!raw) continue;
      const record = JSON.parse(raw);
      if (record.to !== userId) continue;
      record.status = Math.max(record.status || 1, 2);
      record.updatedAt = Date.now();
      await cache.hSet(statusKey(senderId), id, JSON.stringify(record));
      delivered.push({ senderId, clientId: record.clientId });
    }
    await cache.hDel(queueKey(userId), clean);
    return { success: true, acked: clean.length, delivered };
  } catch (err) {
    logger.error("[messageQueue.ackMessages] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- receiver opened a conversation -> mark messages read ---------- */
const markMessagesRead = async (readerId, ids) => {
  try {
    if (!Number.isInteger(readerId)) return fail("Not authenticated.");
    if (!Array.isArray(ids) || ids.length === 0) return fail("No message ids given.");

    const clean = ids
      .filter((id) => typeof id === "string" && id.length <= 80)
      .slice(0, MAX_ACK_BATCH);
    const read = [];

    for (const id of clean) {
      const senderId = Number(id.split(":", 1)[0]);
      if (!Number.isInteger(senderId) || senderId === readerId) continue;
      const raw = await cache.hGet(statusKey(senderId), id);
      if (!raw) continue;
      const record = JSON.parse(raw);
      // A user can only mark a message as read if it was addressed to them and
      // accepted by the server. The recipient can only know its id after receipt.
      if (record.to !== readerId || (record.status || 0) < 1) continue;
      if (record.status < 3) {
        record.status = 3;
        record.updatedAt = Date.now();
        await cache.hSet(statusKey(senderId), id, JSON.stringify(record));
      }
      read.push({ senderId, clientId: record.clientId });
    }
    return { success: true, read };
  } catch (err) {
    logger.error("[messageQueue.markMessagesRead] " + err.message);
    return fail("Internal Server Error");
  }
};

/* ---------- sender reconnects -> reconcile locally stored statuses ---------- */
const getMessageStatuses = async (senderId, clientIds) => {
  try {
    if (!Number.isInteger(senderId)) return fail("Not authenticated.");
    if (!Array.isArray(clientIds)) return fail("Invalid message ids.");
    const clean = clientIds
      .filter((id) => typeof id === "string" && /^[\w-]{1,64}$/.test(id))
      .slice(0, MAX_ACK_BATCH);
    const statuses = [];
    for (const clientId of clean) {
      const raw = await cache.hGet(statusKey(senderId), `${senderId}:${clientId}`);
      if (!raw) continue;
      const record = JSON.parse(raw);
      statuses.push({ clientId, status: record.status || 1 });
    }
    return { success: true, statuses };
  } catch (err) {
    logger.error("[messageQueue.getMessageStatuses] " + err.message);
    return fail("Internal Server Error");
  }
};

module.exports = {
  enqueueMessage,
  getPending,
  ackMessages,
  markMessagesRead,
  getMessageStatuses,
};
