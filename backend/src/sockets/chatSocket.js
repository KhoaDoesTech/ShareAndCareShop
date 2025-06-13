'use strict';

const TokenRepository = require('../repositories/token.repository');
const UserRepository = require('../repositories/user.repository');
const { parseJwt } = require('../utils/helpers');
const { validateToken } = require('../helpers/auth.helper');
const { UnauthorizedError } = require('../utils/errorResponse');
const { UserStatus } = require('../constants/status');
const { ChatEventEnum } = require('../constants/chatEvent');
const ChatService = require('../services/chat.service');
const logger = require('../helpers/logger.helper');
const ChatRoomRepository = require('../repositories/chatRoom.repository');

class ChatSocketHandler {
  constructor(io) {
    this.io = io;
    this.chatService = new ChatService();
    this.chatService.setSocketIO(io);

    this.chatRoomRepository = new ChatRoomRepository();
  }

  initializeSocketIO() {
    this.io.on('connection', async (socket) => {
      try {
        const token =
          socket.handshake.auth?.token || socket.handshake.headers['token'];
        const deviceToken =
          socket.handshake.auth?.deviceToken ||
          socket.handshake.headers['devicetoken'];
        const role =
          socket.handshake.auth?.role || socket.handshake.headers['role'];

        const { user, isAnonymous } = await this.validateSocketConnection(
          token,
          deviceToken
        );

        socket.user = user;
        socket.role = role;

        if (!isAnonymous) {
          socket.join(user.id.toString());
          await this.joinChatRooms(socket, user, role);
        } else {
          socket.join(deviceToken.toString());
        }

        socket.emit(ChatEventEnum.CONNECTED_EVENT, {
          user,
          role,
          message: 'Connected to chat system',
        });

        console.log(
          `User connected: ${isAnonymous ? 'anonymous' : 'authenticated'} - ${
            user.id
          }`
        );

        // Xử lý sự kiện gửi tin nhắn
        socket.on(ChatEventEnum.SEND_MESSAGE, async (data) => {
          console.log(`Received send_message event:`, data);
          await this.handleSendMessage(socket, data, isAnonymous);
        });

        // Xử lý sự kiện đánh dấu tin nhắn đã xem
        socket.on(ChatEventEnum.MARK_MESSAGE_SEEN, async (data) => {
          await this.handleMarkMessageSeen(socket, data);
        });

        // Xử lý sự kiện typing
        socket.on(ChatEventEnum.TYPING, async (data) => {
          await this.handleTyping(socket, data);
        });

        // Xử lý sự kiện stop typing
        socket.on(ChatEventEnum.STOP_TYPING, async (data) => {
          await this.handleStopTyping(socket, data);
        });

        // Xử lý sự kiện ngắt kết nối
        socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
          logger.info(`User disconnected: ${socket.user?.id} (${socket.role})`);
          socket.leave(socket.user.id);
        });
      } catch (error) {
        console.error('Socket connection error:', error);
        socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, error.message);
      }
    });
  }

  async validateSocketConnection(token, deviceToken) {
    const tokenRepository = new TokenRepository();
    const userRepository = new UserRepository();

    if (token) {
      const decoded = parseJwt(token);
      const userId = decoded.userId;

      if (!userId || !deviceToken) throw new UnauthorizedError('Invalid token');

      const keyStore = await tokenRepository.getToken({ userId, deviceToken });
      if (!keyStore) throw new UnauthorizedError('Token not found');

      await validateToken(token, keyStore.publicKey, userId);

      const user = await userRepository.getByQuery(
        { _id: userId, usr_status: UserStatus.ACTIVE },
        { path: 'usr_role', select: 'rol_name rol_permissions' }
      );

      if (!user) throw new NotFoundError('User not found');

      return { user, isAnonymous: false };
    }

    // Anonymous logic
    if (!deviceToken)
      throw new UnauthorizedError('DeviceToken required for anonymous users');

    return {
      user: {
        id: `${deviceToken}`,
        anonymous: true,
        deviceToken,
      },
      isAnonymous: true,
    };
  }

  async joinChatRooms(socket, user, role) {
    try {
      let chatRooms = [];

      if (role === 'admin') {
        socket.join('admin_room');
        logger.info(`Admin ${user.id} joined admin_room`);
        chatRooms = await this.chatRoomRepository.getAll({
          filter: { room_supporters: user.id },
        });
      } else {
        chatRooms = await this.chatRoomRepository.getAll({
          filter: { room_user_id: user.id },
        });
      }

      chatRooms.forEach((room) => {
        socket.join(room.id.toString());
        logger.info(`User ${user.id} (${role}) joined room ${room.id}`);
      });
    } catch (error) {
      logger.error(
        `Failed to join chat rooms for user ${user.id} (${role}):`,
        error
      );
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, {
        message: 'Failed to join chat rooms',
      });
    }
  }

  async handleSendMessage(socket, data, isAnonymous) {
    try {
      const { conversationId, content, imageUrls = [], useAI = true } = data;

      let response;
      if (isAnonymous) {
        response = await this.chatService.postMessageByAnonymous({
          deviceToken: socket.user.deviceToken,
          content,
          imageUrls,
          useAI,
        });
      } else {
        response = await this.chatService.postMessageByUser({
          user: socket.user,
          conversationId,
          content,
          imageUrls,
          role: socket.role,
          useAI,
        });
      }

      socket.join(response.conversationId.toString());
      logger.info(
        `User ${socket.user.id} (${socket.role}) joined room ${response.conversationId}`
      );
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, {
        message: error.message || 'Failed to send message',
      });
    }
  }

  async handleMarkMessageSeen(socket, data) {
    try {
      const { conversationId } = data;
      if (!conversationId) {
        throw new BadRequestError('Conversation ID is required');
      }

      const updatedMessages = await this.chatService.markMessageAsSeen({
        conversationId,
        userId: socket.user.id,
      });

      this.io.to(conversationId.toString()).emit(ChatEventEnum.MESSAGE_SEEN, {
        conversationId,
        updatedMessages,
      });
    } catch (error) {
      logger.error('Mark message seen error:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, {
        message: error.message || 'Failed to mark message as seen',
      });
    }
  }

  async handleTyping(socket, data) {
    try {
      const { conversationId } = data;
      if (!conversationId) {
        throw new BadRequestError('Conversation ID is required');
      }

      this.io.to(conversationId.toString()).emit(ChatEventEnum.TYPING, {
        conversationId,
        userId: socket.user.id,
        role: socket.role,
      });
    } catch (error) {
      logger.error('Typing event error:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, {
        message: error.message || 'Failed to process typing event',
      });
    }
  }

  async handleStopTyping(socket, data) {
    try {
      const { conversationId } = data;
      if (!conversationId) {
        throw new BadRequestError('Conversation ID is required');
      }

      this.io.to(conversationId.toString()).emit(ChatEventEnum.STOP_TYPING, {
        conversationId,
        userId: socket.user.id,
        role: socket.role,
      });
    } catch (error) {
      logger.error('Stop typing event error:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, {
        message: error.message || 'Failed to process stop typing event',
      });
    }
  }
}

module.exports = ChatSocketHandler;
