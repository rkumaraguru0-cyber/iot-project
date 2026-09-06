const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');
const { User, Device, Incident } = require('../models');

let ioInstance = null;

/**
 * Initializes and attaches the Socket.IO server to an HTTP server instance.
 *
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 20000,
    pingInterval: 25000
  });

  // Authentication middleware for Socket.IO handshake
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim();
        }
      }

      if (!token) {
        const err = new Error('Authentication token required');
        err.data = { code: 'UNAUTHORIZED' };
        return next(err);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (jwtErr) {
        const err = new Error(
          jwtErr.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid authentication token'
        );
        err.data = { code: jwtErr.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' };
        return next(err);
      }

      const user = await User.findById(decoded.userId).select('+isActive');
      if (!user || !user.isActive) {
        const err = new Error('User account inactive or not found');
        err.data = { code: 'UNAUTHORIZED' };
        return next(err);
      }

      socket.user = {
        userId: user._id.toString(),
        organizationId: user.organizationId.toString(),
        role: user.role,
        displayName: user.displayName,
        email: user.email
      };

      next();
    } catch (err) {
      logger.error(`[Socket.IO Auth] Handshake error: ${err.message}`);
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const { userId, organizationId } = socket.user;
    logger.info(`[Socket.IO] Client connected: socketId=${socket.id}, user=${userId}, org=${organizationId}`);

    // Auto-join mandatory tenant room and user personal notification room
    socket.join(`org:${organizationId}`);
    socket.join(`user:${userId}`);

    // Explicit room-control: join/leave device room
    socket.on('join:device', async (data, callback) => {
      try {
        const deviceId = typeof data === 'string' ? data : data?.deviceId;
        if (!deviceId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Device ID required' });
          return;
        }

        const filter = { organizationId: new mongoose.Types.ObjectId(organizationId) };
        if (mongoose.Types.ObjectId.isValid(deviceId)) {
          filter._id = new mongoose.Types.ObjectId(deviceId);
        } else {
          filter.deviceId = deviceId;
        }

        const device = await Device.findOne(filter);
        if (!device) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Device not found in organization' });
          }
          return;
        }

        const targetRoom = `device:${device.deviceId || device._id.toString()}`;
        socket.join(targetRoom);
        if (typeof callback === 'function') callback({ success: true, room: targetRoom });
      } catch (err) {
        logger.error(`[Socket.IO] join:device error: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: 'Failed to join device room' });
      }
    });

    socket.on('leave:device', (data, callback) => {
      const deviceId = typeof data === 'string' ? data : data?.deviceId;
      if (deviceId) {
        socket.leave(`device:${deviceId}`);
      }
      if (typeof callback === 'function') callback({ success: true });
    });

    // Explicit room-control: join/leave incident room
    socket.on('join:incident', async (data, callback) => {
      try {
        const incidentId = typeof data === 'string' ? data : data?.incidentId;
        if (!incidentId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Incident ID required' });
          return;
        }

        const filter = { organizationId: new mongoose.Types.ObjectId(organizationId) };
        if (mongoose.Types.ObjectId.isValid(incidentId)) {
          filter._id = new mongoose.Types.ObjectId(incidentId);
        } else {
          filter.incidentId = incidentId;
        }

        const incident = await Incident.findOne(filter);
        if (!incident) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Incident not found in organization' });
          }
          return;
        }

        const targetRoom = `incident:${incident.incidentId || incident._id.toString()}`;
        socket.join(targetRoom);
        if (typeof callback === 'function') callback({ success: true, room: targetRoom });
      } catch (err) {
        logger.error(`[Socket.IO] join:incident error: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: 'Failed to join incident room' });
      }
    });

    socket.on('leave:incident', (data, callback) => {
      const incidentId = typeof data === 'string' ? data : data?.incidentId;
      if (incidentId) {
        socket.leave(`incident:${incidentId}`);
      }
      if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: socketId=${socket.id}, reason=${reason}`);
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Returns the current active Socket.IO server instance.
 * @returns {Server|null}
 */
const getSocketServer = () => ioInstance;

/**
 * Sets the active Socket.IO server instance (useful for test suites and mocking).
 * @param {Server|null} instance
 */
const setSocketServer = (instance) => {
  ioInstance = instance;
};

/**
 * Gracefully closes the Socket.IO server instance.
 * @returns {Promise<void>}
 */
const closeSocketServer = async () => {
  if (ioInstance) {
    await new Promise((resolve) => ioInstance.close(resolve));
    ioInstance = null;
  }
};

module.exports = {
  initSocketServer,
  getSocketServer,
  setSocketServer,
  closeSocketServer
};
