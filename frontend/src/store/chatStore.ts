import { create } from 'zustand';
import api from '../services/api';
import { getSocket, initSocket } from '../services/socket';
import { ChatConversation, ChatMessage, ChatNotification, ChatUser, MessageType, ChatThemeConfig } from '../types';
import { playNotificationSound } from '../utils/sound';
import { DEFAULT_THEME, THEME_PRESETS } from '../utils/theme';
import toast from 'react-hot-toast';

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  onlineUserIds: string[];
  typingUsers: Record<string, string | null>; // conversationId -> typing user name
  unreadTotal: number;
  popupNotifications: ChatNotification[];
  availableUsers: ChatUser[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  soundEnabled: boolean;
  personalTheme: ChatThemeConfig;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchAvailableUsers: (search?: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  selectConversation: (conversationId: string | null) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    type?: MessageType,
    attachment?: { url: string; name: string; size: number; type: string; duration?: number | null }
  ) => Promise<ChatMessage | null>;
  startConversationWithUser: (userId: string) => Promise<string | null>;
  createGroup: (title: string, memberIds: string[], description?: string, themeId?: string) => Promise<string | null>;
  fetchPersonalTheme: () => Promise<void>;
  updatePersonalTheme: (theme: Partial<ChatThemeConfig>) => Promise<void>;
  updateGroupTheme: (conversationId: string, theme: Partial<ChatThemeConfig>) => Promise<void>;
  getActiveTheme: () => ChatThemeConfig;
  markConversationRead: (conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string, conversationId: string) => Promise<void>;
  pinMessage: (messageId: string, conversationId: string) => Promise<boolean>;
  forwardMessage: (messageId: string, targetConversationIds: string[], targetUserIds?: string[]) => Promise<boolean>;
  emitTyping: (conversationId: string, receiverId: string, isTyping: boolean) => void;
  dismissPopupNotification: (id: string) => void;
  toggleSound: () => void;
  initChat: () => void;
  cleanupChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  onlineUserIds: [],
  typingUsers: {},
  unreadTotal: 0,
  popupNotifications: [],
  availableUsers: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  soundEnabled: true,
  personalTheme: DEFAULT_THEME,

  fetchConversations: async () => {
    try {
      set({ isLoadingConversations: true });
      const res = await api.get('/chat/conversations');
      const convs: ChatConversation[] = res.data.data || [];
      const totalUnread = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      set({ conversations: convs, unreadTotal: totalUnread, isLoadingConversations: false });
    } catch (err) {
      set({ isLoadingConversations: false });
    }
  },

  fetchAvailableUsers: async (search?: string) => {
    try {
      const url = search ? `/chat/users?search=${encodeURIComponent(search)}` : '/chat/users';
      const res = await api.get(url);
      set({ availableUsers: res.data.data || [] });
    } catch {
      // silent
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get('/chat/unread-count');
      set({ unreadTotal: res.data.count || 0 });
    } catch {
      // silent
    }
  },

  fetchPersonalTheme: async () => {
    try {
      const res = await api.get('/chat/theme');
      if (res.data?.data) {
        set({ personalTheme: res.data.data });
      }
    } catch {
      // fallback to DEFAULT_THEME
    }
  },

  updatePersonalTheme: async (newTheme: Partial<ChatThemeConfig>) => {
    try {
      const current = get().personalTheme;
      const merged = { ...current, ...newTheme };
      set({ personalTheme: merged as ChatThemeConfig });

      const res = await api.put('/chat/theme', merged);
      if (res.data?.data) {
        set({ personalTheme: res.data.data });
      }
      toast.success('Personal chat theme updated!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update theme');
    }
  },

  updateGroupTheme: async (conversationId: string, newTheme: Partial<ChatThemeConfig>) => {
    try {
      const conv = get().conversations.find((c) => c.id === conversationId);
      const current = conv?.groupTheme || DEFAULT_THEME;
      const merged = { ...current, ...newTheme };

      const res = await api.put(`/chat/groups/${conversationId}/theme`, merged);
      const updatedTheme = res.data?.data || merged;

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, groupTheme: updatedTheme } : c
        ),
      }));

      toast.success('Group chat theme updated for all members!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Only Administrators can update group theme');
    }
  },

  getActiveTheme: () => {
    const { conversations, activeConversationId, personalTheme } = get();
    if (!activeConversationId) return personalTheme;

    const conv = conversations.find((c) => c.id === activeConversationId);
    if (conv?.conversationType === 'GROUP' && conv.groupTheme) {
      return conv.groupTheme;
    }
    return personalTheme;
  },

  selectConversation: async (conversationId: string | null) => {
    set({ activeConversationId: conversationId });
    if (!conversationId) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('join_conversation', { conversationId });
    }

    // Fetch messages for this conversation
    await get().fetchMessages(conversationId);

    // Mark as read
    await get().markConversationRead(conversationId);
  },

  fetchMessages: async (conversationId: string) => {
    try {
      set({ isLoadingMessages: true });
      const res = await api.get(`/chat/conversations/${conversationId}/messages?limit=100`);
      const msgs = res.data.data || [];
      set((state) => ({
        messages: { ...state.messages, [conversationId]: msgs },
        isLoadingMessages: false,
      }));
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (conversationId, content, type = 'TEXT', attachment) => {
    try {
      set({ isSendingMessage: true });
      const payload: any = {
        messageContent: content,
        messageType: type,
      };
      if (attachment) {
        payload.attachmentUrl = attachment.url;
        payload.attachmentName = attachment.name;
        payload.attachmentSize = attachment.size;
        payload.attachmentType = attachment.type;
        if (attachment.duration !== undefined && attachment.duration !== null) {
          payload.duration = attachment.duration;
        }
      }

      const res = await api.post(`/chat/conversations/${conversationId}/messages`, payload);
      const newMsg: ChatMessage = res.data.data;

      // Update state immediately if not already added by socket
      set((state) => {
        const currentMsgs = state.messages[conversationId] || [];
        const exists = currentMsgs.some((m) => m.id === newMsg.id);
        const updatedMsgs = exists ? currentMsgs : [...currentMsgs, newMsg];

        // Update conversation's lastMessage
        const updatedConvs = state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() }
            : c
        );

        return {
          messages: { ...state.messages, [conversationId]: updatedMsgs },
          conversations: updatedConvs,
          isSendingMessage: false,
        };
      });

      return newMsg;
    } catch (err) {
      set({ isSendingMessage: false });
      throw err;
    }
  },

  startConversationWithUser: async (recipientId: string) => {
    try {
      const res = await api.post('/chat/conversations', { recipientId });
      const conv: ChatConversation = res.data.data;

      set((state) => {
        const exists = state.conversations.some((c) => c.id === conv.id);
        return {
          conversations: exists
            ? state.conversations
            : [conv, ...state.conversations],
        };
      });

      await get().selectConversation(conv.id);
      return conv.id;
    } catch (err) {
      console.error('Failed to start conversation:', err);
      return null;
    }
  },

  createGroup: async (title: string, memberIds: string[], description?: string, themeId?: string) => {
    try {
      const res = await api.post('/chat/groups', {
        title,
        description,
        memberIds,
        themeId: themeId || 'classic-blue',
      });

      const newGroup: ChatConversation = res.data.data;
      set((state) => ({
        conversations: [newGroup, ...state.conversations],
      }));

      await get().selectConversation(newGroup.id);
      toast.success(`Group "${title}" created successfully!`);
      return newGroup.id;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create group');
      return null;
    }
  },

  markConversationRead: async (conversationId: string) => {
    try {
      await api.post(`/chat/conversations/${conversationId}/read`);
      set((state) => {
        let diff = 0;
        const updatedConvs = state.conversations.map((c) => {
          if (c.id === conversationId) {
            diff = c.unreadCount;
            return { ...c, unreadCount: 0 };
          }
          return c;
        });

        // Also mark local messages as read
        const currentMsgs = state.messages[conversationId] || [];
        const now = new Date().toISOString();
        const updatedMsgs = currentMsgs.map((m) =>
          m.readAt ? m : { ...m, readAt: now, deliveredAt: m.deliveredAt || now }
        );

        return {
          conversations: updatedConvs,
          messages: { ...state.messages, [conversationId]: updatedMsgs },
          unreadTotal: Math.max(0, state.unreadTotal - diff),
        };
      });
    } catch {
      // silent
    }
  },

  deleteMessage: async (messageId: string, conversationId: string) => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      set((state) => {
        const msgs = (state.messages[conversationId] || []).map((m) =>
          m.id === messageId
            ? {
                ...m,
                isDeleted: true,
                messageContent: 'This message was deleted',
                attachmentUrl: null,
                attachmentName: null,
              }
            : m
        );
        return {
          messages: { ...state.messages, [conversationId]: msgs },
        };
      });
    } catch (err) {
      throw err;
    }
  },

  pinMessage: async (messageId: string, conversationId: string) => {
    try {
      const res = await api.patch(`/chat/messages/${messageId}/pin`);
      const { isPinned, pinnedAt } = res.data.data;
      set((state) => {
        const msgs = (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, isPinned, pinnedAt } : m
        );
        return {
          messages: { ...state.messages, [conversationId]: msgs },
        };
      });
      toast.success(isPinned ? 'Message pinned' : 'Message unpinned');
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update pin status');
      return false;
    }
  },

  forwardMessage: async (messageId: string, targetConversationIds: string[], targetUserIds: string[] = []) => {
    try {
      await api.post(`/chat/messages/${messageId}/forward`, {
        targetConversationIds,
        targetUserIds,
      });
      await get().fetchConversations();
      toast.success('Message forwarded successfully');
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to forward message');
      return false;
    }
  },

  emitTyping: (conversationId: string, receiverId: string, isTyping: boolean) => {
    const socket = getSocket();
    if (!socket) return;
    const event = isTyping ? 'typing_start' : 'typing_stop';
    socket.emit(event, { conversationId, receiverId });
  },

  dismissPopupNotification: (id: string) => {
    set((state) => ({
      popupNotifications: state.popupNotifications.filter((n) => n.id !== id),
    }));
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  initChat: () => {
    const socket = initSocket();
    if (!socket) return;

    // Remove existing listeners to avoid duplicates
    socket.off('online_users');
    socket.off('user_online');
    socket.off('user_offline');
    socket.off('receive_message');
    socket.off('message_delivered');
    socket.off('messages_read');
    socket.off('typing_start');
    socket.off('typing_stop');
    socket.off('message_deleted');
    socket.off('message_pinned');
    socket.off('new_notification');
    socket.off('conversation_created');
    socket.off('group_theme_updated');

    // Online users list on initial connection
    socket.on('online_users', (userIds: string[]) => {
      set({ onlineUserIds: userIds });
    });

    // Single user online
    socket.on('user_online', (data: { userId: string }) => {
      set((state) => ({
        onlineUserIds: Array.from(new Set([...state.onlineUserIds, data.userId])),
      }));
    });

    // Single user offline
    socket.on('user_offline', (data: { userId: string; lastSeenAt: string }) => {
      set((state) => ({
        onlineUserIds: state.onlineUserIds.filter((id) => id !== data.userId),
      }));
    });

    // Group or Direct conversation created
    socket.on('conversation_created', (conv: ChatConversation) => {
      set((state) => {
        const exists = state.conversations.some((c) => c.id === conv.id);
        if (exists) return state;
        return { conversations: [conv, ...state.conversations] };
      });
    });

    // Group Theme Updated in Real-Time
    socket.on('group_theme_updated', (data: { conversationId: string; groupTheme: ChatThemeConfig }) => {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === data.conversationId ? { ...c, groupTheme: data.groupTheme } : c
        ),
      }));
    });

    // Receive message
    socket.on('receive_message', (msg: ChatMessage) => {
      const state = get();
      const isCurrentConv = state.activeConversationId === msg.conversationId;

      // Update message list
      const currentMsgs = state.messages[msg.conversationId] || [];
      const exists = currentMsgs.some((m) => m.id === msg.id);
      const updatedMsgs = exists ? currentMsgs : [...currentMsgs, msg];

      // Update conversation list
      let convFound = false;
      const updatedConvs = state.conversations.map((c) => {
        if (c.id === msg.conversationId) {
          convFound = true;
          return {
            ...c,
            lastMessage: msg,
            updatedAt: msg.createdAt,
            unreadCount: isCurrentConv ? 0 : (c.unreadCount || 0) + 1,
          };
        }
        return c;
      });

      // If this conversation was not in state, re-fetch conversations
      if (!convFound) {
        state.fetchConversations();
      }

      set({
        messages: { ...state.messages, [msg.conversationId]: updatedMsgs },
        conversations: updatedConvs,
        unreadTotal: isCurrentConv ? state.unreadTotal : state.unreadTotal + 1,
      });

      // If current conversation, mark as read automatically
      if (isCurrentConv) {
        get().markConversationRead(msg.conversationId);
      }
    });

    // New notification (popup trigger)
    socket.on('new_notification', (data: any) => {
      const state = get();
      // If user is currently in that conversation, don't popup notification
      if (state.activeConversationId === data.conversationId) {
        return;
      }

      if (state.soundEnabled) {
        playNotificationSound();
      }

      const newNotif: ChatNotification = {
        id: data.id || `notif-${Date.now()}`,
        messageId: data.id,
        conversationId: data.conversationId,
        conversationType: data.conversationType,
        groupTitle: data.groupTitle,
        sender: data.sender,
        messageContent: data.messageContent,
        messageType: data.messageType || 'TEXT',
        createdAt: data.createdAt || new Date().toISOString(),
        isRead: false,
      };

      set((s) => ({
        popupNotifications: [newNotif, ...s.popupNotifications.slice(0, 4)],
      }));

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        get().dismissPopupNotification(newNotif.id);
      }, 6000);
    });

    // Message delivered status update
    socket.on('message_delivered', (data: { messageId: string; conversationId: string; deliveredAt: string }) => {
      set((state) => {
        const msgs = (state.messages[data.conversationId] || []).map((m) =>
          m.id === data.messageId ? { ...m, deliveredAt: data.deliveredAt } : m
        );
        return {
          messages: { ...state.messages, [data.conversationId]: msgs },
        };
      });
    });

    // Messages read status update
    socket.on('messages_read', (data: { conversationId: string; readerId: string; messageIds: string[]; readAt: string }) => {
      set((state) => {
        const msgs = (state.messages[data.conversationId] || []).map((m) =>
          data.messageIds.includes(m.id)
            ? { ...m, readAt: data.readAt, deliveredAt: m.deliveredAt || data.readAt }
            : m
        );
        return {
          messages: { ...state.messages, [data.conversationId]: msgs },
        };
      });
    });

    // Typing start
    socket.on('typing_start', (data: { conversationId: string; userId: string }) => {
      const conv = get().conversations.find((c) => c.id === data.conversationId);
      const name = conv?.otherUser?.name || 'Someone';
      set((state) => ({
        typingUsers: { ...state.typingUsers, [data.conversationId]: name },
      }));
    });

    // Typing stop
    socket.on('typing_stop', (data: { conversationId: string }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [data.conversationId]: null },
      }));
    });

    // Message deleted
    socket.on('message_deleted', (data: { messageId: string; conversationId: string }) => {
      set((state) => {
        const msgs = (state.messages[data.conversationId] || []).map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isDeleted: true,
                messageContent: 'This message was deleted',
                attachmentUrl: null,
                attachmentName: null,
              }
            : m
        );
        return {
          messages: { ...state.messages, [data.conversationId]: msgs },
        };
      });
    });

    // Message pinned / unpinned
    socket.on('message_pinned', (data: { messageId: string; conversationId: string; isPinned: boolean; pinnedAt: string | null }) => {
      set((state) => {
        const msgs = (state.messages[data.conversationId] || []).map((m) =>
          m.id === data.messageId ? { ...m, isPinned: data.isPinned, pinnedAt: data.pinnedAt } : m
        );
        return {
          messages: { ...state.messages, [data.conversationId]: msgs },
        };
      });
    });

    // Initial fetch of unread count, conversations, and personal theme
    get().fetchConversations();
    get().fetchUnreadCount();
    get().fetchPersonalTheme();
  },

  cleanupChat: () => {
    // Keep connection if user is logged in, but clean up active conversation
    set({ activeConversationId: null });
  },
}));
