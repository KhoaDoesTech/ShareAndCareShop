'use strict';

class ChatSocketHandler {
  constructor(io, chatService) {
    this.io = io;
    this.chatService = chatService;
    this.connectedUsers = new Map(); // Tracks authenticated users
    this.anonymousUsers = new Map(); // Tracks anonymous users
    this.connectedAdmins = new Map(); // Tracks connected admins
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`New socket connection: ${socket.id}`);
    });
  }
}

module.exports = ChatSocketHandler;
