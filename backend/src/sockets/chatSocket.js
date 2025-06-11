'use strict';

const TokenRepository = require('../repositories/token.repository');
const UserRepository = require('../repositories/user.repository');
const { parseJwt } = require('../utils/helpers');
const { validateToken } = require('../helpers/auth.helper');
const { UnauthorizedError } = require('../utils/errorResponse');
const { UserStatus } = require('../constants/status');
const { ChatEventEnum } = require('../constants/chatEvent');
const ChatService = require('../services/chat.service');

class ChatSocketHandler {
  constructor(io) {
    this.io = io;
    this.chatService = new ChatService();
    this.chatService.setSocketIO(io);
  }

  initializeSocketIO() {
    this.io.on('connection', async (socket) => {
      try {
        const token =
          socket.handshake.auth?.token || socket.handshake.headers['token'];
        const deviceToken =
          socket.handshake.auth?.deviceToken ||
          socket.handshake.headers['devicetoken'];

        const { user, isAnonymous } = await this.validateSocketConnection(
          token,
          deviceToken
        );

        socket.user = user;
        socket.join(user.id.toString());

        socket.emit(ChatEventEnum.CONNECTED_EVENT, { user });

        console.log(
          `User connected: ${isAnonymous ? 'anonymous' : 'authenticated'} - ${
            user.id
          }`
        );

        // Mount events
        this.mountJoinChatEvent(socket);
        this.mountParticipantTypingEvent(socket);
        this.mountParticipantStoppedTypingEvent(socket);

        socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
          console.log(`User disconnected: ${socket.user?.id}`);
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
}

module.exports = ChatSocketHandler;
