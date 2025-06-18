'use strict';

const OpenAI = require('openai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAIEmbeddings, ChatOpenAI } = require('@langchain/openai');
const { QdrantVectorStore } = require('@langchain/qdrant');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const config = require('../configs/server.config');
const ChatRoomRepository = require('../repositories/chatRoom.repository');
const ChatMessageRepository = require('../repositories/chatMessage.repository');
const UserRepository = require('../repositories/user.repository');
const { omitFields, listResponse } = require('../utils/helpers');
const { BadRequestError } = require('../utils/errorResponse');
const ProductRepository = require('../repositories/product.repository');
const { ProductStatus } = require('../constants/status');
const { ChatEventEnum } = require('../constants/chatEvent');
const documents = require('../../data/documents');

class ChatService {
  constructor() {
    this.roomRepository = new ChatRoomRepository();
    this.messageRepository = new ChatMessageRepository();
    this.userRepository = new UserRepository();
    this.productRepository = new ProductRepository();
    this.openai = new OpenAI({ apiKey: config.openAi.API_KEY });
    this.qdrant = new QdrantClient({
      url: config.qdrant.URL,
      apiKey: config.qdrant.API_KEY,
    });
    this.embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      openAIApiKey: config.openAi.API_KEY,
    });
    this.chatModel = new ChatOpenAI({
      model: 'gpt-4.1-nano',
      maxTokens: 512,
      temperature: 0.7,
      openAIApiKey: config.openAi.API_KEY,
    });

    this.io = null;
    this.vectorStore = null;
  }

  async init() {
    console.log('Initializing ChatService...');
    // Ensure Qdrant collection exists
    await this._initQdrantCollection();
    // Initialize Qdrant vector store
    this.vectorStore = await QdrantVectorStore.fromExistingCollection(
      this.embeddings,
      {
        collectionName: config.qdrant.COLLECTION_NAME,
        url: config.qdrant.URL,
        apiKey: config.qdrant.API_KEY,
      }
    );
  }

  setSocketIO(io) {
    this.io = io;
  }

  getSocketIO() {
    if (!this.io) {
      throw new BadRequestError('Socket.IO chưa được khởi tạo');
    }
    return this.io;
  }

  async _initQdrantCollection() {
    const collectionName = config.qdrant.COLLECTION_NAME;
    const collections = await this.qdrant.getCollections();
    const collectionExists = collections.collections.some(
      (c) => c.name === collectionName
    );
    if (!collectionExists) {
      await this.qdrant.createCollection(collectionName, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
      console.log(`Created Qdrant collection: ${collectionName}`);
    }
  }

  async textToNoSQL() {
    try {
      await this.qdrant.deleteCollection(config.qdrant.COLLECTION_NAME);
      await this._initQdrantCollection();
      // 1. Fetch products from MongoDB
      const mongoProducts = await this.productRepository.getAll({
        filter: { prd_status: ProductStatus.PUBLISHED },
      });

      // Format MongoDB products into documents
      const mongoDocuments = mongoProducts.map((product) => ({
        pageContent: [
          `Sản phẩm: ${product.name}`,
          `Mã sản phẩm: ${product.code}`,
          `Giá thấp nhất: ${product.minPrice} ₫`,
          `Giá cao nhất: ${product.maxPrice} ₫`,
          `Tình trạng kho: Còn ${product.quantity || 0} sản phẩm`,
        ].join(' '),
        metadata: {
          source: `https://share-and-care-client.vercel.app/product/${product.code}`,
          type: 'product',
          productId: String(product.code),
        },
      }));

      // 2. Load documents from documents.js
      const staticDocuments = documents; // Already in the correct format

      // 3. Combine documents
      const allDocuments = [...mongoDocuments, ...staticDocuments];

      // 4. Add documents to Qdrant
      if (allDocuments.length > 0) {
        await this.vectorStore.addDocuments(allDocuments);
        console.log(
          `Added ${allDocuments.length} documents to Qdrant collection ${config.qdrant.COLLECTION_NAME}`
        );
      } else {
        console.log('No documents to add to Qdrant');
      }

      return { status: 'success', documentCount: allDocuments.length };
    } catch (error) {
      console.error('Error in textToNoSQL:', error.message);
      throw new BadRequestError(
        `Thêm tài liệu vào Qdrant thất bại: ${error.message}`
      );
    }
  }

  async postMessageByAnonymous({
    deviceToken,
    content,
    imageUrls = [],
    useAI = true,
  }) {
    if (!deviceToken) {
      throw new BadRequestError(
        'Thiếu mã định danh: deviceToken, userId hoặc adminId'
      );
    }
    if (!content && imageUrls.length === 0) {
      throw new BadRequestError(
        'Thiếu trường bắt buộc: vai trò, nội dung hoặc hình ảnh'
      );
    }

    const chatRoom = await this._getOrCreateChatRoom({
      deviceToken,
      isAdminSupport: !useAI,
    });

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

    if (this.io) {
      console.log('Hello');
      this.io
        .to([chatRoom.id.toString(), deviceToken])
        .emit(ChatEventEnum.NEW_MESSAGE, {
          conversationId: chatRoom.id,
          userMessages: userMessage.map((msg) =>
            omitFields({
              fields: ['updatedAt', 'conversationId'],
              object: msg,
            })
          ),
          aiResponse: aiResponse
            ? omitFields({
                fields: ['updatedAt', 'conversationId'],
                object: aiResponse,
              })
            : null,
        });

      if (!chatRoom.supporters || chatRoom.supporters.length === 0) {
        console.log('Sending to admin room');
        this.io.to('admin_room').emit(ChatEventEnum.REFRESH_CONVERSATIONS, {
          conversationId: chatRoom.id,
        });
      }
    }

    return {
      conversationId: chatRoom.id,
      userMessages: userMessage.map((msg) =>
        omitFields({
          fields: ['updatedAt', 'conversationId'],
          object: msg,
        })
      ),
      aiResponse: omitFields({
        fields: ['updatedAt', 'conversationId'],
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
        'Thiếu trường bắt buộc: vai trò, nội dung hoặc hình ảnh'
      );
    }
    let chatRoom;
    if (conversationId) {
      chatRoom = await this.roomRepository.getById(conversationId);
      if (!chatRoom) {
        throw new BadRequestError('Không tìm thấy phòng chat');
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

    if (this.io) {
      this.io
        .to([chatRoom.id.toString(), chatRoom.userId.toString()])
        .emit(ChatEventEnum.NEW_MESSAGE, {
          conversationId: chatRoom.id,
          userMessages: userMessage.map((msg) =>
            omitFields({
              fields: ['updatedAt', 'conversationId'],
              object: msg,
            })
          ),
          aiResponse: aiResponse
            ? omitFields({
                fields: ['updatedAt', 'conversationId'],
                object: aiResponse,
              })
            : null,
        });

      if (
        role === 'user' &&
        (!chatRoom.supporters || chatRoom.supporters.length === 0)
      ) {
        console.log('Sending to admin room');
        this.io.to('admin_room').emit(ChatEventEnum.REFRESH_CONVERSATIONS, {
          conversationId: chatRoom.id,
        });
      }
    }

    return {
      conversationId: chatRoom.id,
      userMessages: userMessage.map((msg) =>
        omitFields({
          fields: ['updatedAt', 'conversationId'],
          object: msg,
        })
      ),
      aiResponse: omitFields({
        fields: ['updatedAt', 'conversationId'],
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
      populateOptions: [
        { path: 'room_user_id', select: 'usr_name usr_avatar' },
      ],
    });

    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const latestMessage =
          await this.messageRepository.getLastestMessageByConversationId(
            room.id
          );

        return {
          id: room.id,
          user: room.userId
            ? {
                id: room.userId.id,
                name: room.userId.usr_name,
                avatar: room.userId.usr_avatar,
              }
            : room.deviceToken,
          latestMessage: omitFields({
            fields: ['updatedAt', 'conversationId', 'senderType'],
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
      populateOptions: [
        { path: 'room_user_id', select: 'usr_name usr_avatar' },
      ],
    });

    const conversations = await Promise.all(
      chatRooms.map(async (room) => {
        const latestMessage =
          await this.messageRepository.getLastestMessageByConversationId(
            room.id
          );

        return {
          id: room.id,
          user: room.userId
            ? {
                id: room.userId.id,
                name: room.userId.usr_name,
                avatar: room.userId.usr_avatar,
              }
            : room.deviceToken,
          latestMessage: omitFields({
            fields: ['updatedAt', 'conversationId', 'senderType'],
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
          fields: ['updatedAt', 'conversationId'],
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
      throw new BadRequestError(
        'Không tìm thấy phòng chat ẩn danh cho thiết bị này'
      );
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
      throw new BadRequestError('Không tìm thấy phòng chat');
    }

    const updatedMessages = await this.messageRepository.updateMany(
      {
        msg_conversation_id: conversationId,
        msg_user_id: { $ne: userId },
        msg_seen: false,
      },
      { $set: { msg_seen: true } }
    );

    if (this.io) {
      this.io.to(conversationId.toString()).emit(ChatEventEnum.MESSAGE_SEEN, {
        conversationId,
        updatedMessages,
      });
    }

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

    if (isAdminSupport && !chatRoom.adminSupportRequested) {
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
    const recentMessages = await this.messageRepository.getAll({
      filter: { msg_conversation_id: conversationId },
      queryOptions: { sort: '-createdAt', page: 1, size: 10 },
    });

    if (!recentMessages || recentMessages.length === 0) {
      return await this.messageRepository.create({
        msg_conversation_id: conversationId,
        msg_sender: 'AI_Assistant',
        msg_sender_type: 'assistant',
        msg_content:
          'Vui lòng cung cấp thêm thông tin để tôi có thể hỗ trợ bạn.',
        msg_seen: false,
      });
    }

    const conversationHistory = recentMessages
      .map((msg) => {
        const { role, content } = this._normalizeMessageRole(msg);
        return `${role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${content}`;
      })
      .join('\n');

    const userQuestion = recentMessages[0].content?.trim() || '';

    // Initialize the retriever
    const retriever = this.vectorStore.asRetriever({
      k: 4, // Retrieve top 4 relevant documents
      searchType: 'similarity',
    });

    // Format documents for the prompt
    const formatDocuments = (docs) => {
      return docs
        .map(
          (doc, index) =>
            `Tài liệu ${index + 1}: ${
              doc.pageContent
            }\nThông tin thêm: ${JSON.stringify(doc.metadata)}`
        )
        .join('\n\n');
    };

    // Define the prompt template
    const promptTemplate = ChatPromptTemplate.fromTemplate(`
      Bạn là trợ lý AI chuyên nghiệp. Hãy trả lời câu hỏi dựa trên thông tin được cung cấp.

      Lịch sử trò chuyện:
      {conversationHistory}

      Thông tin tham khảo:
      {context}

      Câu hỏi: {question}

      Yêu cầu:
      - Chỉ trả lời dựa trên thông tin được cung cấp
      - Nếu không có thông tin liên quan, hãy thông báo không đủ dữ liệu
      - Trả lời bằng tiếng Việt rõ ràng và chính xác
      - Giữ thái độ chuyên nghiệp và thân thiện

      Câu trả lời:
    `);

    // Create the RAG chain
    const ragChain = RunnableSequence.from([
      {
        context: (input) =>
          retriever.invoke(input.question).then(formatDocuments),
        question: (input) => input.question,
        conversationHistory: () => conversationHistory,
      },
      promptTemplate,
      this.chatModel,
      new StringOutputParser(),
    ]);

    // Generate the AI response using the RAG chain
    const aiContent = await ragChain.invoke({ question: userQuestion });

    // Save and return the AI response
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
}

module.exports = ChatService;
