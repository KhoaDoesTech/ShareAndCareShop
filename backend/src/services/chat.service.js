// services/chat.service.js
'use strict';

const OpenAI = require('openai');
const config = require('../configs/server.config');
const ChatRoomRepository = require('../repositories/chatRoom.repository');
const ChatMessageRepository = require('../repositories/chatMessage.repository');
const UserRepository = require('../repositories/user.repository');
const { omitFields } = require('../utils/helpers');
const { BadRequestError } = require('../utils/errorResponse');
const logger = require('../helpers/logger.helper');

class ChatService {
  constructor() {
    this.roomRepository = new ChatRoomRepository();
    this.messageRepository = new ChatMessageRepository();
    this.userRepository = new UserRepository();
    this.openai = new OpenAI({
      apiKey: config.openAi.API_KEY,
    });
    this.activeAdminSessions = new Map();
    this.conversationStates = new Map();
  }

  _normalizeMessageRole(msg, defaultRole = 'user', forOpenAI = false) {
    const validRoles = forOpenAI
      ? ['system', 'assistant', 'user', 'function', 'tool', 'developer']
      : ['system', 'user', 'AI'];
    let role =
      msg.msg_sender_type === 'AI'
        ? forOpenAI
          ? 'assistant'
          : 'AI'
        : msg.msg_role;
    if (!validRoles.includes(role)) {
      logger.warn(
        `Invalid or missing role for message: ${JSON.stringify(
          msg
        )}. Defaulting to '${defaultRole}'`
      );
      role = defaultRole;
    }
    let content = msg.msg_content || '';
    if (msg.msg_image) {
      content = content
        ? `${content} [Image: ${msg.msg_image}]`
        : `[Image: ${msg.msg_image}]`;
    }
    if (!content.trim()) {
      logger.warn(
        `Empty content for message: ${JSON.stringify(msg)}. Using fallback.`
      );
      content = 'No content provided';
    }
    return { role, content };
  }

  async postMessage({
    deviceToken,
    userId,
    adminId,
    role,
    content,
    imageUrls = [],
    useAI,
    senderType = 'user',
  }) {
    if (!deviceToken && !userId && !adminId) {
      throw new BadRequestError(
        'Missing required identifier: deviceToken, userId, or adminId'
      );
    }
    if (!role || (!content && imageUrls.length === 0)) {
      throw new BadRequestError(
        'Missing required fields: role, and at least content or imageUrls'
      );
    }

    const chatRoom = await this._getOrCreateChatRoom({ deviceToken, userId });
    let sender = await this._determineSender(
      { deviceToken, userId, adminId },
      senderType
    );

    const userMessages = await this._saveMessages({
      chatRoomId: chatRoom.id,
      sender,
      role,
      content,
      imageUrls,
      senderType,
      adminId,
    });

    const conversationState = this.conversationStates.get(chatRoom.id) || {
      mode: 'AI',
    };

    if (
      role === 'user' &&
      useAI &&
      conversationState.mode === 'AI' &&
      senderType === 'user'
    ) {
      const aiMessage = await this._generateAIResponse(
        chatRoom.id,
        userMessages
      );
      return {
        userMessages: userMessages.map((msg) =>
          omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
        ),
        aiMessage: aiMessage
          ? omitFields({
              object: aiMessage,
              fields: ['createdAt', 'updatedAt'],
            })
          : null,
      };
    }

    return {
      userMessages: userMessages.map((msg) =>
        omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
      ),
    };
  }

  async _determineSender({ deviceToken, userId, adminId }, senderType) {
    if (adminId && senderType === 'admin') {
      const admin = await this.userRepository.getById(adminId);
      if (!admin) throw new BadRequestError('Admin not found');
      return `admin_${admin.email || admin.username}`;
    } else if (userId) {
      const foundUser = await this.userRepository.getById(userId);
      if (!foundUser) throw new BadRequestError('User not found');
      return foundUser.email;
    }
    return deviceToken;
  }

  async _saveMessages({
    chatRoomId,
    sender,
    role,
    content,
    imageUrls,
    senderType,
    adminId,
  }) {
    const messages = [];
    if (content) {
      const message = await this.messageRepository.create({
        msg_conversation_id: chatRoomId,
        msg_sender: sender,
        msg_role: role,
        msg_content: content,
        msg_image: null,
        msg_seen: false,
        msg_sender_type: senderType,
        msg_admin_id: adminId || null,
      });
      messages.push(message);
    }
    for (const imageUrl of imageUrls) {
      const message = await this.messageRepository.create({
        msg_conversation_id: chatRoomId,
        msg_sender: sender,
        msg_role: role,
        msg_content: null,
        msg_image: imageUrl,
        msg_seen: false,
        msg_sender_type: senderType,
        msg_admin_id: adminId || null,
      });
      messages.push(message);
    }
    return messages;
  }

  async _generateAIResponse(conversationId, userMessages) {
    try {
      const previousMessages = await this.messageRepository.getAll({
        filter: { msg_conversation_id: conversationId },
        queryOptions: { sort: 'created_at' },
      });

      const messages = [
        {
          role: 'system',
          content: `
            Bạn là trợ lý bán hàng thông minh cho cửa hàng ShareAndCare.
            - Trả lời câu hỏi về sản phẩm chính xác, hữu ích.
            - Gợi ý sản phẩm phù hợp với nhu cầu khách hàng.
            - Hỗ trợ mua sắm, thân thiện, chuyên nghiệp.
            - Cung cấp link thanh toán: http://localhost:3000/portal/payment/[sender]
            - Cung cấp link đặt lịch: http://localhost:3000/portal/appointment/[sender]
            - Nếu cần hỗ trợ phức tạp, thông báo kết nối với nhân viên.
          `,
        },
        ...previousMessages.map((msg) =>
          this._normalizeMessageRole(msg, 'user', true)
        ),
        ...userMessages.map((msg) =>
          this._normalizeMessageRole(msg, 'user', true)
        ),
      ];

      logger.info(`Sending to OpenAI: ${JSON.stringify(messages, null, 2)}`);

      const aiResponse = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const aiContent = aiResponse.choices[0].message.content;
      return await this.messageRepository.create({
        msg_conversation_id: conversationId,
        msg_sender: 'AI_Assistant',
        msg_role: 'AI',
        msg_content: aiContent,
        msg_seen: false,
        msg_sender_type: 'AI',
      });
    } catch (error) {
      logger.error('AI response error:', error);
      const fallbackMessage = await this.messageRepository.create({
        msg_conversation_id: conversationId,
        msg_sender: 'AI_Assistant',
        msg_role: 'AI',
        msg_content:
          'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu. Bạn có thể thử lại hoặc liên hệ admin để được hỗ trợ.',
        msg_seen: false,
        msg_sender_type: 'AI',
      });
      return fallbackMessage;
    }
  }

  async takeOverConversation({ conversationId, adminId }) {
    try {
      logger.info(
        `Attempting to take over conversation ${conversationId} by admin ${adminId}`
      );
      const admin = await this.userRepository.getById(adminId);
      if (!admin) {
        logger.error(`Admin not found: ${adminId}`);
        throw new BadRequestError(`Admin not found: ${adminId}`);
      }

      const chatRoom = await this.roomRepository.getById(conversationId);
      if (!chatRoom) {
        logger.error(`Chat room not found: ${conversationId}`);
        throw new BadRequestError(`Chat room not found: ${conversationId}`);
      }

      this.conversationStates.set(conversationId, {
        mode: 'ADMIN',
        adminId,
        takenOverAt: new Date(),
      });
      this.activeAdminSessions.set(conversationId, adminId);

      const systemMessage = await this.messageRepository.create({
        msg_conversation_id: conversationId,
        msg_sender: 'system',
        msg_role: 'system',
        msg_content: `Nhân viên tư vấn ${
          admin.name || admin.email
        } đã tham gia cuộc trò chuyện`,
        msg_seen: false,
        msg_sender_type: 'system',
        msg_admin_id: adminId,
      });

      // Phát sự kiện socket để thông báo admin tham gia phòng
      const io = this.getIO(); // Giả định có phương thức getIO từ app.js
      if (io) {
        io.to(conversationId).emit('new_message', {
          messages: [systemMessage],
          type: 'system',
        });
        logger.info(
          `Emitted system message for admin ${adminId} joining room ${conversationId}`
        );
      }

      logger.info(`Admin ${adminId} took over conversation ${conversationId}`);
      return {
        message: 'Conversation taken over successfully',
        admin: omitFields({
          object: admin,
          fields: ['password', 'createdAt', 'updatedAt'],
        }),
        systemMessage: omitFields({
          object: systemMessage,
          fields: ['createdAt', 'updatedAt'],
        }),
        messages: (await this.getConversation(conversationId)).messages,
      };
    } catch (error) {
      logger.error(`Take over conversation error: ${error.message}`, error);
      throw error;
    }
  }

  async releaseConversation({ conversationId, adminId }) {
    const currentState = this.conversationStates.get(conversationId);
    if (!currentState || currentState.adminId !== adminId) {
      throw new BadRequestError('Unauthorized to release this conversation');
    }

    this.conversationStates.set(conversationId, { mode: 'AI' });
    this.activeAdminSessions.delete(conversationId);

    const admin = await this.userRepository.getById(adminId);
    const systemMessage = await this.messageRepository.create({
      msg_conversation_id: conversationId,
      msg_sender: 'system',
      msg_role: 'system',
      msg_content: `Cuộc trò chuyện đã được chuyển về AI Assistant. Cảm ơn bạn đã sử dụng dịch vụ!`,
      msg_seen: false,
      msg_sender_type: 'system',
    });

    // Phát sự kiện socket
    const io = this.getIO();
    if (io) {
      io.to(conversationId).emit('new_message', {
        messages: [systemMessage],
        type: 'system',
      });
    }

    logger.info(`Admin ${adminId} released conversation ${conversationId}`);
    return {
      message: 'Conversation released to AI successfully',
      systemMessage: omitFields({
        object: systemMessage,
        fields: ['createdAt', 'updatedAt'],
      }),
    };
  }

  async getConversation(conversationId) {
    const messages = await this.messageRepository.getAll({
      filter: { msg_conversation_id: conversationId },
      queryOptions: { sort: 'created_at' },
    });
    return {
      messages: messages.map((msg) =>
        omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
      ),
    };
  }

  async getConversationBySender({ deviceToken, userId }) {
    if (!deviceToken && !userId)
      throw new BadRequestError('Missing deviceToken or userId');
    const chatRooms = await this._getChatRoomBySender({ deviceToken, userId });
    if (!chatRooms.length) return { conversations: [] };

    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const messages = await this.messageRepository.getAll({
          filter: { msg_conversation_id: room.id },
          queryOptions: { sort: 'created_at' },
        });
        const conversationState = this.conversationStates.get(room.id) || {
          mode: 'AI',
        };
        return {
          ...omitFields({ object: room, fields: ['createdAt', 'updatedAt'] }),
          messages: messages.map((msg) =>
            omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
          ),
          mode: conversationState.mode,
          hasAdminSupport: conversationState.mode === 'ADMIN',
        };
      })
    );
    return { conversations };
  }

  async mergeAnonymousChatToUser({ deviceToken, userId }) {
    if (!deviceToken || !userId)
      throw new BadRequestError('Missing deviceToken or userId');
    const anonymousRoom = await this.roomRepository.getByQuery({
      room_device_token: deviceToken,
      room_user_id: null,
    });

    if (!anonymousRoom) {
      return { message: 'No anonymous chat found to merge' };
    }

    let userRoom = await this.roomRepository.getByQuery({
      room_user_id: userId,
    });
    if (!userRoom) {
      userRoom = await this.roomRepository.updateById(anonymousRoom.id, {
        room_user_id: userId,
      });
      return {
        message: 'Anonymous chat successfully converted to user chat',
        mergedRoomId: userRoom.id,
      };
    }

    const anonymousMessages = await this.messageRepository.getAll({
      filter: { msg_conversation_id: anonymousRoom.id },
      queryOptions: { sort: 'created_at' },
    });

    const transferPromises = anonymousMessages.map(async (msg) => {
      return await this.messageRepository.create({
        msg_conversation_id: userRoom.id,
        msg_sender: msg.msg_sender,
        msg_role: msg.msg_role,
        msg_content: msg.msg_content,
        msg_image: msg.msg_image,
        msg_seen: msg.msg_seen,
        msg_sender_type: msg.msg_sender_type || 'user',
        msg_admin_id: msg.msg_admin_id,
      });
    });

    await Promise.all(transferPromises);
    await this.messageRepository.deleteMany({
      filter: { msg_conversation_id: anonymousRoom.id },
    });
    await this.roomRepository.deleteById(anonymousRoom.id);

    const conversationState = this.conversationStates.get(anonymousRoom.id);
    if (io) {
      io.to(userRoom.id).emit('new_message', {
        messages: [systemMessage],
        type: 'system',
      });
    }

    if (conversationState) {
      this.conversationStates.set(userRoom.id, conversationState);
      this.conversationStates.delete(anonymousRoom.id);
    }

    return {
      message: 'Anonymous chat history merged successfully',
      mergedMessagesCount: anonymousMessages.length,
      targetRoomId: userRoom.id,
    };
  }

  async markMessagesAsSeen({ conversationId, userId, deviceToken }) {
    const chatRoom = await this._getOrCreateChatRoom({ deviceToken, userId });
    if (chatRoom.id !== conversationId) {
      throw new BadRequestError('Unauthorized access to conversation');
    }

    const result = await this.messageRepository.updateMany({
      filter: { msg_conversation_id: conversationId, msg_seen: false },
      update: { msg_seen: true },
    });

    return {
      message: 'Messages marked as seen',
      updatedCount: result.modifiedCount,
    };
  }

  async deleteConversation({ conversationId, userId, deviceToken }) {
    const chatRoom = await this._getOrCreateChatRoom({ deviceToken, userId });
    if (chatRoom.id !== conversationId) {
      throw new BadRequestError('Unauthorized access to conversation');
    }

    await this.messageRepository.deleteMany({
      filter: { msg_conversation_id: conversationId },
    });
    await this.roomRepository.deleteById(conversationId);
    this.conversationStates.delete(conversationId);
    this.activeAdminSessions.delete(conversationId);

    return { message: 'Conversation deleted successfully' };
  }

  async getUnseenMessageCount({ userId, deviceToken }) {
    const chatRooms = await this._getChatRoomBySender({ deviceToken, userId });
    let totalUnseen = 0;
    for (const room of chatRooms) {
      const unseenMessages = await this.messageRepository.getAll({
        filter: {
          msg_conversation_id: room.id,
          msg_seen: false,
          msg_sender_type: { $ne: 'user' },
        },
      });
      totalUnseen += unseenMessages.length;
    }
    return { unseenCount: totalUnseen };
  }

  async _getOrCreateChatRoom({ deviceToken, userId }) {
    const query = userId
      ? { room_user_id: userId }
      : { room_device_token: deviceToken, room_user_id: null };

    let chatRoom = await this.roomRepository.getByQuery(query);
    if (!chatRoom) {
      const createData = userId
        ? { room_user_id: userId, room_device_token: deviceToken }
        : { room_device_token: deviceToken };
      chatRoom = await this.roomRepository.create(createData);

      // Tạo tin nhắn chào mừng
      await this.messageRepository.create({
        msg_conversation_id: chatRoom.id,
        msg_sender: 'system',
        msg_role: 'system',
        msg_content:
          'Xin chào! Tôi là trợ lý ảo của ShareAndCare. Tôi có thể giúp bạn tìm hiểu về sản phẩm, đặt lịch hẹn hoặc trả lời các câu hỏi. Bạn cần hỗ trợ gì hôm nay?',
        msg_seen: false,
        msg_sender_type: 'system',
      });
    } else if (userId && !chatRoom.room_user_id) {
      chatRoom = await this.roomRepository.updateById(chatRoom.id, {
        room_user_id: userId,
      });
    } else if (deviceToken && chatRoom.id !== deviceToken) {
      chatRoom = await this.roomRepository.updateById(chatRoom.id, {
        room_device_token: deviceToken,
      });
    }
    return chatRoom;
  }

  async _getChatRoomBySender({ deviceToken, userId }) {
    if (userId) {
      return await this.roomRepository.getAll({
        filter: { room_user_id: userId },
      });
    }
    return await this.roomRepository.getAll({
      filter: { room_device_token: deviceToken, room_user_id: null },
    });
  }

  // Thêm phương thức để lấy io instance
  getIO() {
    return this.io; // Giả định io được inject vào service
  }

  // Phương thức để set io instance
  setIO(io) {
    this.io = io;
  }
}

module.exports = ChatService;
