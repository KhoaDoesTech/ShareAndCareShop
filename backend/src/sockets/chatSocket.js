'use strict';

const logger = require('../helpers/logger.helper');

class ChatSocketHandler {
  constructor(io, chatService) {
    this.io = io;
    this.chatService = chatService;
    this.connectedUsers = new Map();
    this.anonymousUsers = new Map();
    this.connectedAdmins = new Map();
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`New socket connection: ${socket.id}`);

      socket.on('join', (data) => this.handleJoin(socket, data));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('mark_seen', (data) => this.handleMarkSeen(socket, data));
      socket.on('user_login', (data) => this.handleUserLogin(socket, data));
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
      socket.on('request_admin', (data) =>
        this.handleRequestAdmin(socket, data)
      );
      socket.on('join_admin', (data) => this.handleJoinAdmin(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  async handleJoin(socket, data) {
    try {
      const { deviceToken, userId } = data;
      if (!deviceToken) {
        socket.emit('error', { message: 'Device token is required' });
        return;
      }

      const chatRoom = await this.chatService._getOrCreateChatRoom({
        deviceToken,
        userId,
      });
      socket.join(chatRoom.id);
      socket.deviceToken = deviceToken;
      socket.userId = userId;
      socket.roomId = chatRoom.id;

      if (userId) this.connectedUsers.set(userId, socket.id);
      else this.anonymousUsers.set(deviceToken, socket.id);

      const conversation = await this.chatService.getConversation(chatRoom.id);
      socket.emit('joined', {
        roomId: chatRoom.id,
        conversation: conversation.messages,
        userType: userId ? 'authenticated' : 'anonymous',
      });

      const unseenCount = await this.chatService.getUnseenMessageCount({
        userId,
        deviceToken,
      });
      socket.emit('unseen_count', unseenCount);

      logger.info(
        `User joined room ${chatRoom.id} - ${
          userId ? `User: ${userId}` : `Anonymous: ${deviceToken}`
        }`
      );
    } catch (error) {
      logger.error('Join error:', error);
      socket.emit('error', { message: 'Failed to join chat room' });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const {
        content,
        imageUrls = [],
        useAI = true,
        senderType = 'user',
        adminId,
        roomId,
      } = data;
      const socketRoomId = roomId || socket.roomId;
      const deviceToken = socket.deviceToken;
      const userId = socket.userId;

      if (!socketRoomId) {
        socket.emit('error', { message: 'Not connected to a chat room' });
        return;
      }

      const result = await this.chatService.postMessage({
        deviceToken,
        userId,
        adminId: senderType === 'admin' ? adminId : undefined,
        role: senderType === 'admin' ? 'admin' : 'user',
        content,
        imageUrls,
        useAI,
        senderType,
      });

      this.io.to(socketRoomId).emit('new_message', {
        messages: result.userMessages,
        type: senderType,
      });

      if (result.aiMessage) {
        setTimeout(() => {
          this.io.to(socketRoomId).emit('new_message', {
            message: result.aiMessage,
            type: 'ai',
          });
        }, 1000);
      }

      logger.info(
        `Message sent in room ${socketRoomId} by ${
          senderType === 'admin' ? `admin_${adminId}` : userId || deviceToken
        }`
      );
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  async handleMarkSeen(socket, data) {
    try {
      const { conversationId } = data;
      const { deviceToken, userId } = socket;
      const result = await this.chatService.markMessagesAsSeen({
        conversationId,
        userId,
        deviceToken,
      });
      socket.emit('messages_marked_seen', result);

      const unseenCount = await this.chatService.getUnseenMessageCount({
        userId,
        deviceToken,
      });
      socket.emit('unseen_count', unseenCount);
    } catch (error) {
      logger.error('Mark seen error:', error);
      socket.emit('error', { message: 'Failed to mark messages as seen' });
    }
  }

  async handleUserLogin(socket, data) {
    try {
      const { userId } = data;
      const { deviceToken } = socket;
      if (!userId || !deviceToken) {
        socket.emit('error', { message: 'User ID and device token required' });
        return;
      }

      const mergeResult = await this.chatService.mergeAnonymousChatToUser({
        deviceToken,
        userId,
      });
      socket.userId = userId;
      this.anonymousUsers.delete(deviceToken);
      this.connectedUsers.set(userId, socket.id);

      const conversations = await this.chatService.getConversationBySender({
        deviceToken,
        userId,
      });
      socket.emit('login_success', {
        mergeResult,
        conversations: conversations.conversations,
      });

      logger.info(
        `User ${userId} logged in, merged anonymous chat for device ${deviceToken}`
      );
    } catch (error) {
      logger.error('User login error:', error);
      socket.emit('error', { message: 'Failed to process login' });
    }
  }

  async handleRequestAdmin(socket, data) {
    try {
      const { roomId, deviceToken, userId } = data;
      if (!roomId) {
        socket.emit('error', { message: 'Not connected to a chat room' });
        return;
      }

      socket.emit('admin_request_response', {
        message: 'Yêu cầu chat với admin đã được gửi. Vui lòng chờ phản hồi.',
        success: true,
      });

      this.io.to('admin_room').emit('admin_alert', {
        roomId,
        userId: userId || deviceToken,
        message: `User ${
          userId || deviceToken
        } requests admin support in room ${roomId}`,
        timestamp: new Date(),
      });

      logger.info(
        `Admin request from ${userId || deviceToken} for room ${roomId}`
      );
    } catch (error) {
      logger.error('Request admin error:', error);
      socket.emit('admin_request_response', {
        message: 'Failed to request admin support',
        success: false,
      });
    }
  }

  async handleJoinAdmin(socket, data) {
    try {
      const { adminId, roomId } = data;
      if (!adminId) {
        socket.emit('error', { message: 'Admin ID required' });
        return;
      }

      socket.join('admin_room');

      if (roomId) {
        socket.join(roomId);

        const conversation = await this.chatService.getConversation(roomId);
        socket.emit('joined', {
          roomId: roomId,
          conversation: conversation.messages,
        });
      }
      this.connectedAdmins.set(adminId, socket.id);

      logger.info(`Admin ${adminId} joined${roomId ? ` room ${roomId}` : ''}`);
    } catch (error) {
      logger.error('Admin join error:', error);
      socket.emit('error', { message: 'Failed to join as admin' });
    }
  }

  handleTypingStart(socket, data) {
    const { roomId } = data || socket;
    if (roomId) {
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId || socket.deviceToken || 'admin',
        isTyping: true,
      });
    }
  }

  handleTypingStop(socket, data) {
    const { roomId } = data || socket;
    if (roomId) {
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId || socket.deviceToken || 'admin',
        isTyping: false,
      });
    }
  }

  handleDisconnect(socket) {
    const { userId, deviceToken, adminId } = socket;
    if (userId) this.connectedUsers.delete(userId);
    else if (deviceToken) this.anonymousUsers.delete(deviceToken);
    else if (adminId) this.connectedAdmins.delete(adminId);
    logger.info(
      `Socket disconnected: ${socket.id} - ${
        userId || adminId || deviceToken || 'unknown'
      }`
    );
  }

  getConnectedUsersCount() {
    return {
      authenticated: this.connectedUsers.size,
      anonymous: this.anonymousUsers.size,
      admins: this.connectedAdmins.size,
      total:
        this.connectedUsers.size +
        this.anonymousUsers.size +
        this.connectedAdmins.size,
    };
  }
}

module.exports = ChatSocketHandler;
