'use strict';

const ChatEventEnum = {
  CONNECTED_EVENT: 'connected',
  DISCONNECT_EVENT: 'disconnect',
  SOCKET_ERROR_EVENT: 'socket_error',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MARK_MESSAGE_SEEN: 'mark_message_seen',
  MESSAGE_SEEN: 'message_seen',
  REFRESH_CONVERSATIONS: 'refresh_conversations',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
};

const AvailableChatEvents = Object.values(ChatEventEnum);

module.exports = {
  ChatEventEnum,
  AvailableChatEvents,
};
