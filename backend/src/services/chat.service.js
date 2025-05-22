'use strict';

const OpenAI = require('openai');
const config = require('../configs/server.config');
const ChatRoomRepository = require('../repositories/chatRoom.repository');
const ChatMessageRepository = require('../repositories/chatMessage.repository');
const UserRepository = require('../repositories/user.repository');
const { omitFields } = require('../utils/helpers');
const { BadRequestError } = require('../utils/errorResponse');

class ChatService {
  constructor() {
    this.roomRepository = new ChatRoomRepository();
    this.messageRepository = new ChatMessageRepository();
    this.userRepository = new UserRepository();
    this.openai = new OpenAI({
      apiKey: config.openAi.API_KEY,
    });
  }

  async postMessage({
    deviceToken,
    userId,
    role,
    content,
    imageUrls = [],
    useAI,
  }) {
    if (!deviceToken || !role || (!content && imageUrls.length === 0)) {
      throw new BadRequestError(
        'Missing required fields: deviceToken, role, and at least content or imageUrls'
      );
    }

    const chatRoom = await this._getOrCreateChatRoom({
      deviceToken,
      userId,
    });

    let sender;
    if (userId) {
      const foundUser = await this.userRepository.getById(userId);
      if (!foundUser) throw new BadRequestError('User not found');
      sender = foundUser.email;
    } else {
      sender = deviceToken;
    }

    let userMessages = [];
    if (content) {
      const message = await this.messageRepository.create({
        msg_conversation_id: chatRoom.id,
        msg_sender: sender,
        msg_role: role,
        msg_content: content,
        msg_image: null,
        msg_seen: false,
      });
      userMessages.push(message);
    }

    for (const imageUrl of imageUrls) {
      const message = await this.messageRepository.create({
        msg_conversation_id: chatRoom.id,
        msg_sender: sender,
        msg_role: role,
        msg_content: null,
        msg_image: imageUrl,
        msg_seen: false,
      });
      userMessages.push(message);
    }

    // Xử lý AI nếu cần
    if (role === 'user' && useAI) {
      const previousMessages = await this.messageRepository.getAll({
        filter: { msg_conversation_id: chatRoom.id },
        queryOptions: { sort: 'created_at' },
      });

      const messages = [
        {
          role: 'system',
          content: `
            Bạn là trợ lý bán hàng cho cửa hàng ShareAndCare.
            Trả lời chính xác và ngắn gọn dựa trên câu hỏi của khách.
            Nếu khách gửi hình ảnh, mô tả hoặc trả lời dựa trên ngữ cảnh phù hợp.
            Nếu khách muốn mua sản phẩm, cung cấp link: http://localhost:3000/portal/payment/${sender}.
            Nếu khách muốn đặt lịch hẹn, cung cấp link: http://localhost:3000/portal/appointment/${sender}.
          `,
        },
        ...previousMessages.map((msg) => ({
          role: msg.role === 'ai' ? 'assistant' : msg.role,
          content: msg.image
            ? `${msg.content || ''} [Image: ${msg.image}]`
            : msg.content,
        })),
        ...userMessages.map((msg) => ({
          role: 'user',
          content: msg.image
            ? `${msg.content || ''} [Image: ${msg.image}]`
            : msg.content,
        })),
      ];

      const aiResponse = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
      });

      const aiContent = aiResponse.choices[0].message.content;

      const aiMessage = await this.messageRepository.create({
        msg_conversation_id: chatRoom.id,
        msg_sender: null,
        msg_role: 'ai',
        msg_content: aiContent,
        msg_seen: false,
      });

      return {
        userMessages: userMessages.map((msg) =>
          omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
        ),
        aiMessage: omitFields({
          object: aiMessage,
          fields: ['createdAt', 'updatedAt'],
        }),
      };
    }

    return {
      userMessages: userMessages.map((msg) =>
        omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
      ),
    };
  }

  async getConversation(conversationId) {
    const messages = await this.messageRepository.getAll({
      filter: { msg_conversation_id: conversationId },
      queryOptions: { sort: 'created_at' },
    });
    if (!messages.length) throw new BadRequestError('Conversation not found');
    return {
      messages: messages.map((msg) =>
        omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
      ),
    };
  }

  async getConversationBySender({ deviceToken, userId }) {
    if (!deviceToken && !userId) {
      throw new BadRequestError('Missing deviceToken or userId');
    }

    const chatRooms = await this._getChatRoomBySender({
      deviceToken,
      userId,
    });
    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const messages = await await this.messageRepository.getAll({
          filter: { msg_conversation_id: room.id },
          queryOptions: { sort: 'created_at' },
        });
        return {
          ...omitFields({ object: room, fields: ['createdAt', 'updatedAt'] }),
          messages: messages.map((msg) =>
            omitFields({ object: msg, fields: ['createdAt', 'updatedAt'] })
          ),
        };
      })
    );

    return { conversations };
  }

  async linkDeviceTokenToUser({ deviceToken, userId }) {
    const user = await mongoose.model('User').findById(userId);
    if (!user) throw new BadRequestError('User not found');

    await this.chatRepository.updateChatRoomByDeviceToken(deviceToken, {
      room_user_id: userId,
    });

    return { message: 'Device linked successfully' };
  }

  async _getOrCreateChatRoom({ deviceToken, userId }) {
    const query = userId
      ? { room_user_id: userId }
      : { room_device_token: deviceToken };

    let chatRoom = await this.roomRepository.getByQuery(query);

    if (!chatRoom) {
      const createData = userId
        ? { room_user_id: userId, room_device_token: deviceToken }
        : { room_device_token: deviceToken };

      chatRoom = await this.roomRepository.create(createData);
    } else if (userId && chatRoom.deviceToken !== deviceToken) {
      chatRoom = await this.roomRepository.updateById(chatRoom.id, {
        room_device_token: deviceToken,
      });
    }

    return chatRoom;
  }

  async _updateChatRoomByDeviceToken(deviceToken, data) {
    const chatRoom = await this.roomRepository.getByQuery({
      room_device_token: deviceToken,
    });
    if (!chatRoom) {
      throw new Error('Chat room not found');
    }
    return await this.roomRepository.updateById(chatRoom.id, data);
  }

  async _getChatRoomBySender({ deviceToken, userId }) {
    if (userId) {
      return await this.roomRepository.getAll({
        filter: { room_user_id: userId },
      });
    }
    return await this.roomRepository.getAll({
      filter: { room_device_token: deviceToken },
    });
  }
}

module.exports = ChatService;
