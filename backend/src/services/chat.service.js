'use strict';

const OpenAI = require('openai');
const config = require('../configs/server.config');
const ChatRoomRepository = require('../repositories/chatRoom.repository');
const ChatMessageRepository = require('../repositories/chatMessage.repository');
const UserRepository = require('../repositories/user.repository');
const { omitFields, listResponse } = require('../utils/helpers');
const { BadRequestError } = require('../utils/errorResponse');
const ProductRepository = require('../repositories/product.repository');
const { ProductStatus } = require('../constants/status');

class ChatService {
  constructor() {
    this.roomRepository = new ChatRoomRepository();
    this.messageRepository = new ChatMessageRepository();
    this.userRepository = new UserRepository();
    this.productRepository = new ProductRepository();
    this.openai = new OpenAI({ apiKey: config.openAi.API_KEY });
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  getSocketIO() {
    if (!this.io) {
      throw new Error('Socket.IO instance is not initialized');
    }
    return this.io;
  }

  async postMessageByAnonymous({
    deviceToken,
    content,
    imageUrls = [],
    useAI = true,
  }) {
    if (!deviceToken) {
      throw new BadRequestError(
        'Missing required identifier: deviceToken, userId, or adminId'
      );
    }
    if (!content && imageUrls.length === 0) {
      throw new BadRequestError(
        'Missing required fields: role, and at least content or imageUrls'
      );
    }

    const chatRoom = await this._getOrCreateChatRoom({
      deviceToken,
      isAdminSupport: !useAI,
    });

    console.log(!useAI);

    const userMessage = await this._saveMessages({
      chatRoomId: chatRoom.id,
      sender: deviceToken || 'user_' + userId,
      role: 'user',
      content,
      imageUrls,
    });

    let aiResponse = null;
    if (useAI) {
      aiResponse = await this._generateEnhancedAIResponse(chatRoom.id);
    }

    return {
      conversationId: chatRoom.id,
      userMessages: userMessage.map((msg) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'conversationId'],
          object: msg,
        })
      ),
      aiResponse: omitFields({
        fields: ['createdAt', 'updatedAt', 'conversationId'],
        object: aiResponse,
      }),
    };
  }

  async postMessageByUser({
    user,
    conversationId,
    content,
    imageUrls = [],
    role,
    useAI = true,
  }) {
    if (!content && imageUrls.length === 0) {
      throw new BadRequestError(
        'Missing required fields: role, and at least content or imageUrls'
      );
    }
    let chatRoom;
    if (conversationId) {
      chatRoom = await this.roomRepository.getById(conversationId);
      if (!chatRoom) {
        throw new BadRequestError('Chat room not found');
      }
    } else {
      chatRoom = await this._getOrCreateChatRoom({
        userId: user.id,
        isAdminSupport: !useAI,
      });
    }

    if (role === 'admin') {
      await this.roomRepository.updateById(chatRoom.id, {
        $addToSet: { room_supporters: user.id },
      });
    }

    const userMessage = await this._saveMessages({
      chatRoomId: chatRoom.id,
      sender: user.name,
      userId: user.id,
      role,
      content,
      imageUrls,
    });

    let aiResponse = null;
    if (useAI && role === 'user') {
      aiResponse = await this._generateEnhancedAIResponse(chatRoom.id);
    }

    return {
      conversationId: chatRoom.id,
      userMessages: userMessage.map((msg) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'conversationId'],
          object: msg,
        })
      ),
      aiResponse: omitFields({
        fields: ['createdAt', 'updatedAt', 'conversationId'],
        object: aiResponse,
      }),
    };
  }

  async getAllConversationsByUser({ userId, page = 1, size = 10 }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const filter = { room_user_id: userId };

    const query = {
      sort: '-updatedAt',
      page: formatPage,
      size: formatSize,
    };

    const chatRooms = await this.roomRepository.getAll({
      filter,
      queryOptions: query,
    });

    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const latestMessage =
          await this.messageRepository.getLastestMessageByConversationId(
            room.id
          );

        return {
          id: room.id,
          latestMessage: omitFields({
            fields: ['createdAt', 'updatedAt', 'conversationId', 'senderType'],
            object: latestMessage,
          }),
        };
      })
    );

    const totalChatRooms = await this.roomRepository.countDocuments(filter);

    return listResponse({
      items: conversations,
      total: totalChatRooms,
      page: formatPage,
      size: formatSize,
    });
  }

  async getAllConversationsByAdmin({
    isMySupport,
    isPendingAdminSupport,
    userId,
    page = 1,
    size = 10,
  }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    let filter = {};
    if (isPendingAdminSupport) {
      filter.room_admin_support_requested = true;
      filter.$or = [
        { room_supporters: { $exists: false } },
        { room_supporters: { $size: 0 } },
      ];
    } else if (isMySupport) {
      filter.room_supporters = userId;
    }

    const query = {
      sort: '-updatedAt',
      page: formatPage,
      size: formatSize,
    };

    const chatRooms = await this.roomRepository.getAll({
      filter,
      queryOptions: query,
    });

    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const latestMessage =
          await this.messageRepository.getLastestMessageByConversationId(
            room.id
          );

        return {
          id: room.id,
          latestMessage: omitFields({
            fields: ['createdAt', 'updatedAt', 'conversationId', 'senderType'],
            object: latestMessage,
          }),
        };
      })
    );

    const totalChatRooms = await this.roomRepository.countDocuments(filter);

    return listResponse({
      items: conversations,
      total: totalChatRooms,
      page: formatPage,
      size: formatSize,
    });
  }

  async getMessageByConversationId({
    conversationId,
    userId,
    page = 1,
    size = 10,
  }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const filter = { msg_conversation_id: conversationId };

    const query = {
      sort: '-updatedAt',
      page: formatPage,
      size: formatSize,
    };

    const messages = await this.messageRepository.getAll({
      filter,
      queryOptions: query,
      populateOptions: [{ path: 'msg_user_id' }],
    });

    const formattedMessages = messages.map((msg) => {
      const isCurrentUser = msg.userId?.id?.toString() === userId.toString();
      return {
        ...msg,
        position: isCurrentUser ? true : false,
      };
    });

    const totalMessages = await this.messageRepository.countDocuments(filter);

    return listResponse({
      items: formattedMessages.map((msg) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'conversationId'],
          object: msg,
        })
      ),
      total: totalMessages,
      page: formatPage,
      size: formatSize,
    });
  }

  async mergeAnonymousChatToUser({ deviceToken, user }) {
    const chatRoom = await this.roomRepository.getByQuery({
      room_device_token: deviceToken,
      room_user_id: null,
    });

    if (!chatRoom) {
      throw new BadRequestError('No anonymous chat room found for this device');
    }

    await this.messageRepository.updateMany(
      { msg_conversation_id: chatRoom.id, msg_user_id: null },
      { $set: { msg_user_id: user.id, msg_sender: user.name } }
    );

    // Update the chat room to associate it with the user
    await this.roomRepository.updateById(chatRoom.id, {
      room_user_id: user.id,
      room_device_token: null,
    });

    return {
      conversationId: chatRoom.id,
    };
  }

  async markMessageAsSeen({ conversationId, userId }) {
    const chatRoom = await this.roomRepository.getById(conversationId);
    if (!chatRoom) {
      throw new BadRequestError('Chat room not found');
    }

    const updatedMessages = await this.messageRepository.updateMany(
      {
        msg_conversation_id: conversationId,
        msg_user_id: { $ne: userId },
        msg_seen: false,
      },
      { $set: { msg_seen: true } }
    );

    return updatedMessages;
  }

  async _getOrCreateChatRoom({ deviceToken, userId, isAdminSupport = false }) {
    const query = userId
      ? { room_user_id: userId }
      : { room_device_token: deviceToken, room_user_id: null };

    let chatRoom = await this.roomRepository.getByQuery(query);

    if (!chatRoom) {
      chatRoom = await this.roomRepository.create({
        room_device_token: deviceToken,
        room_user_id: userId || null,
        room_supporters: [],
      });
    }

    if (isAdminSupport && !chatRoom.room_admin_support_requested) {
      chatRoom = await this.roomRepository.updateById(chatRoom.id, {
        room_admin_support_requested: true,
      });
    }

    return chatRoom;
  }

  async _saveMessages({
    chatRoomId,
    sender,
    userId,
    role,
    content,
    imageUrls,
  }) {
    const messages = [];
    const baseData = {
      msg_conversation_id: chatRoomId,
      msg_sender: sender,
      msg_user_id: userId || null,
      msg_sender_type: role,
      msg_seen: false,
    };

    if (content) {
      const message = await this.messageRepository.create({
        ...baseData,
        msg_content: content,
        msg_image: null,
      });
      messages.push(message);
    }

    for (const imageUrl of imageUrls) {
      const message = await this.messageRepository.create({
        ...baseData,
        msg_content: null,
        msg_image: imageUrl,
      });
      messages.push(message);
    }

    return messages;
  }

  async _generateEnhancedAIResponse(conversationId) {
    console.log(conversationId);
    const previousMessages = await this.messageRepository.getAll({
      filter: { msg_conversation_id: conversationId },
      queryOptions: { sort: 'createdAt', size: 20 },
    });

    console.log(previousMessages);

    const systemPrompt = await this._buildSystemPrompt();

    const messages = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map((msg) => this._normalizeMessageRole(msg)),
    ];

    console.log(messages);

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
      msg_sender_type: 'assistant',
      msg_content: aiContent,
      msg_seen: false,
    });
  }

  _normalizeMessageRole(msg) {
    const validRoles = ['system', 'user', 'assistant'];
    const roleMap = {
      user: 'user',
      admin: 'user',
      assistant: 'assistant',
      system: 'system',
    };

    let role = roleMap[msg.senderType] || 'user';

    if (!validRoles.includes(role)) {
      role = 'user';
    }

    let content = msg.content?.trim() || '';
    if (msg.content) {
      content = content
        ? `${content} [Image: ${msg.image}]`
        : `[Image: ${msg.image}]`;
    }

    if (!content.trim()) {
      content = 'No content provided';
    }

    return { role, content };
  }

  async _buildSystemPrompt() {
    //   const products = await this.productRepository.getAll({
    //     filter: { prd_status: ProductStatus.PUBLISHED },
    //   });

    //   console.log(products);

    //   const productDescriptions = products
    //     .map(
    //       (p) => `- ${p.name} (Giá: ${p.price}đ)
    // + Hình ảnh: ${p.mainImage}
    // + Xem chi tiết: https://share-and-care-client.vercel.app/products/${p.slug}
    // + Mô tả: ${p.description || 'Không có mô tả'}`
    //     )
    //     .join('\n\n');

    //   console.log(productDescriptions);

    return `
      Bạn là trợ lý mua sắm của cửa hàng ShareAndCare, chuyên bán quần áo cho mọi lứa tuổi.

      Yêu cầu:
      - Chỉ trả lời bằng văn bản thuần túy (plain text), tuyệt đối không dùng emoji, ký tự đặc biệt, hình ảnh, hoặc ký hiệu biểu cảm.
      - Luôn lịch sự, thân thiện, dùng ngôn ngữ tự nhiên và dễ hiểu.
      - Hỗ trợ khách hàng trong các nội dung sau:
        + Tư vấn sản phẩm quần áo (theo giới tính, độ tuổi, phong cách, kích cỡ)
        + Hướng dẫn đặt hàng, thanh toán, kiểm tra đơn hàng
        + Thông tin về cửa hàng ShareAndCare (giờ mở cửa, chi nhánh, chính sách)

      Hướng dẫn bổ sung:
      - Ưu tiên gợi ý sản phẩm cụ thể nếu phù hợp với câu hỏi.
      - Nếu chưa đủ thông tin, hãy đặt câu hỏi đơn giản để xác định rõ nhu cầu khách hàng.
    `.trim();
  }
}

module.exports = ChatService;
