// Put at: src/utils/handlers/chat/chatHandlers.js
//
// All chat-related socket events live here, so websockets.js stays small.
// websockets.js calls registerChatHandlers(socket, { guard, emitToUser })
// once per connected socket.
//
// This file contains NO database code. It receives an event, calls a service
// (chatLinks.js -> Supabase, messageQueue.js -> Redis), then notifies people.

const { sendRequest, respondToLink, listLinks, areLinked } = require("./chatLinks.js");
const { enqueueMessage, getPending, ackMessages } = require("./messageQueue.js");

const registerChatHandlers = (socket, { guard, emitToUser }) => {
  // These come from the verified token, never from anything the client sends
  const { userId, username } = socket.data.user;

  /* ================= CHAT LINKS (requests) ================= */

  // app -> server: { username }
  socket.on(
    "link_request",
    guard(socket, async (data, ack) => {
      const r = await sendRequest(userId, data?.username);
      if (!r.success) return ack(r);

      // Knock on the other user's door (if offline, they'll see it via list_links)
      emitToUser(r.otherUserId, "link_update", {
        linkId: r.linkId,
        status: r.status,
        user: { userId, username },
      });
      ack({ success: true, linkId: r.linkId, status: r.status });
    })
  );

  // app -> server: { linkId, action: "accept" | "decline" | "block" | "unblock" }
  socket.on(
    "link_respond",
    guard(socket, async (data, ack) => {
      const r = await respondToLink(userId, Number(data?.linkId), data?.action);
      if (!r.success) return ack(r);

      // Only accepts are announced. Declines and blocks stay silent.
      if (r.status === "accepted") {
        emitToUser(r.otherUserId, "link_update", {
          linkId: r.linkId,
          status: "accepted",
          user: { userId, username },
        });
      }
      ack({ success: true, linkId: r.linkId, status: r.status });
    })
  );

  // app -> server: no data. Call right after connecting.
  socket.on(
    "list_links",
    guard(socket, async (_data, ack) => {
      ack(await listLinks(userId));
    })
  );

  /* ================= MESSAGES ================= */

  // app -> server: { to: <userId>, clientId: "<uuid>", text: "hello" }
  // The ack means "the server accepted it", NOT "the other person received it".
  socket.on(
    "send_message",
    guard(socket, async (data, ack) => {
      const to = Number(data?.to);
      if (!Number.isInteger(to) || to === userId) {
        return ack({ success: false, reason: "Invalid recipient." });
      }

      // Only accepted links can message. Same vague error for "not linked" and
      // "blocked", so nobody learns whether they were blocked.
      if (!(await areLinked(userId, to))) {
        return ack({ success: false, reason: "You can't message this user." });
      }

      const r = await enqueueMessage({
        from: userId,
        fromUsername: username,
        to,
        clientId: data?.clientId,
        text: data?.text,
      });
      if (!r.success) return ack(r);

      // Push live. If the receiver is offline nobody hears it, but the message
      // is safe in the queue and arrives via pending_messages.
      // A duplicate means the sender is retrying, so don't push it twice.
      if (!r.duplicate) emitToUser(to, "new_message", r.message);

      ack({ success: true, messageId: r.messageId });
    })
  );

  // app -> server: no data. Call right after connecting (and after list_links).
  socket.on(
    "pending_messages",
    guard(socket, async (_data, ack) => {
      ack(await getPending(userId)); // { success, messages: [...] }
    })
  );

  // app -> server: { ids: ["1:abc", ...] }
  // Send this AFTER the messages are saved in the phone's local database.
  socket.on(
    "message_ack",
    guard(socket, async (data, ack) => {
      ack(await ackMessages(userId, data?.ids));
    })
  );
};

module.exports = { registerChatHandlers };