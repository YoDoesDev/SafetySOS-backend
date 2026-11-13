const { Server } = require("socket.io");
const { verifyAccessToken } = require("./jwtHandlers.js");
const logger = require("./logger.js");
const { registerChatHandlers } = require("../handlers/chat/chatHandlers.js");

let io = null;

/* ---------- tiny per-socket rate limiter (20 events / 10s) ---------- */
const WINDOW_MS = 10_000;
const MAX_EVENTS = 20;

const allowEvent = (socket) => {
  const now = Date.now();
  if (!socket.data.window || now - socket.data.window.start > WINDOW_MS) {
    socket.data.window = { start: now, count: 0 };
  }
  socket.data.window.count += 1;
  return socket.data.window.count <= MAX_EVENTS;
};

/* ---------- wrap handlers: rate limit + ack safety + error catching ---------- */
const guard = (socket, handler) => async (...args) => {
  const ack = typeof args[args.length - 1] === "function" ? args.pop() : () => {};
  try {
    if (!allowEvent(socket)) {
      return ack({ success: false, reason: "Too many requests. Slow down." });
    }
    await handler(args[0], ack);
  } catch (err) {
    logger.error("Socket handler error: " + err.stack);
    ack({ success: false, reason: "Internal Server Error" });
  }
};

const initSockets = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
    maxHttpBufferSize: 1e5, // 100 KB max per event
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  /* ---------- authenticate BEFORE the connection is accepted ---------- */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("unauthorized"));
      }

      const check = await verifyAccessToken(token); // signature + Redis session
      if (!check.result) return next(new Error("unauthorized"));

      const { userId, username, deviceId, exp } = check.payload;
      socket.data.user = { userId, username, deviceId, exp };
      next();
    } catch (err) {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, username, deviceId, exp } = socket.data.user;

    // Every user has a personal room (for delivering messages to all their devices)
    // and every device has its own room (for targeted logout disconnects)
    socket.join(`user:${userId}`);
    socket.join(`device:${userId}:${deviceId}`);

    // Disconnect when the access token expires; the app should refresh and reconnect
    const msLeft = exp * 1000 - Date.now();
    const expiryTimer = setTimeout(() => {
      socket.emit("session_expired");
      socket.disconnect(true);
    }, Math.max(msLeft, 0));

    logger.info(`Socket connected: user ${userId} (${username})`);

    /* ---- test event: confirms auth worked ---- */
    socket.on(
      "whoami",
      guard(socket, async (_data, ack) => {
        ack({ success: true, userId, username });
      })
    );

    // All chat events (links + messages) live in chatHandlers.js
    registerChatHandlers(socket, { guard, emitToUser });

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      logger.info(`Socket disconnected: user ${userId}`);
    });
  });

  return io;
};

/* ---------- helpers for other modules ---------- */

// Deliver an event to every connected device of a user
const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

// Used by logout so a revoked session can't keep a live socket
const disconnectDevice = (userId, deviceId) => {
  if (io) io.in(`device:${userId}:${deviceId}`).disconnectSockets(true);
};

module.exports = { initSockets, emitToUser, disconnectDevice };