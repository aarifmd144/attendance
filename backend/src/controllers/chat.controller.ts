import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {
  emitToConversation,
  emitToUser,
  isUserOnline,
} from '../services/socket.service';
import {
  isChatAllowed,
  formatUserDisplay,
  THEME_PRESETS,
  DEFAULT_THEME,
} from '../utils/chatUtils';

// Re-export for any dependent modules
export { isChatAllowed, formatUserDisplay };

// GET /api/chat/users - Get contacts current user can chat with
export const getAvailableUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;
    const search = (req.query.search as string)?.trim() || '';

    // Determine allowed roles
    let allowedRoles: ('ADMIN' | 'EMPLOYEE' | 'FOOD_OWNER')[] = [];
    if (currentUserRole === 'ADMIN') {
      allowedRoles = ['ADMIN', 'EMPLOYEE', 'FOOD_OWNER'];
    } else if (currentUserRole === 'EMPLOYEE') {
      allowedRoles = ['ADMIN', 'EMPLOYEE', 'FOOD_OWNER'];
    } else if (currentUserRole === 'FOOD_OWNER') {
      allowedRoles = ['ADMIN', 'EMPLOYEE'];
    }

    const whereClause: any = {
      id: { not: currentUserId },
      role: { in: allowedRoles },
    };

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { employeeId: { contains: search, mode: 'insensitive' } },
              { department: { name: { contains: search, mode: 'insensitive' } } },
              { designation: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        role: true,
        lastSeenAt: true,
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            profilePhoto: true,
            designation: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const formatted = users.map(formatUserDisplay);

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/conversations - List conversations for current user
export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;

    const participations = await prisma.chatParticipant.findMany({
      where: { userId: currentUserId },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    const conversationIds = participations.map((p) => p.conversationId);
    if (conversationIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const conversations = await prisma.chatConversation.findMany({
      where: { id: { in: conversationIds } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                lastSeenAt: true,
                employee: {
                  select: {
                    id: true,
                    employeeId: true,
                    name: true,
                    profilePhoto: true,
                    designation: true,
                    department: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute unread counts and format data for both DIRECT and GROUP conversations
    const result = await Promise.all(
      conversations.map(async (conv) => {
        let otherUser = null;
        let title = conv.title;
        let avatarUrl = conv.avatarUrl;

        if (conv.conversationType === 'DIRECT') {
          const otherParticipantObj = conv.participants.find((p) => p.userId !== currentUserId);
          otherUser = otherParticipantObj ? formatUserDisplay(otherParticipantObj.user) : null;
          title = otherUser?.name || 'Direct Chat';
          avatarUrl = otherUser?.avatar || null;
        }

        const unreadCount = await prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            senderId: { not: currentUserId },
            readAt: null,
          },
        });

        const lastMsg = conv.messages[0] || null;

        return {
          id: conv.id,
          conversationType: conv.conversationType,
          title,
          description: conv.description,
          avatarUrl,
          createdById: conv.createdById,
          groupTheme: conv.groupTheme,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          otherUser,
          participants: conv.participants.map((p) => formatUserDisplay(p.user)),
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                senderId: lastMsg.senderId,
                messageType: lastMsg.messageType,
                messageContent: lastMsg.isDeleted ? 'This message was deleted' : lastMsg.messageContent,
                attachmentUrl: lastMsg.attachmentUrl,
                attachmentName: lastMsg.attachmentName,
                createdAt: lastMsg.createdAt,
                deliveredAt: lastMsg.deliveredAt,
                readAt: lastMsg.readAt,
                isDeleted: lastMsg.isDeleted,
              }
            : null,
          unreadCount,
        };
      })
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/conversations - Get or create a direct conversation
const createConvSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
});

export const getOrCreateConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId } = createConvSchema.parse(req.body);
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    if (recipientId === currentUserId) {
      return next(createError('Cannot start a conversation with yourself', 400));
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    if (!recipient) {
      return next(createError('Recipient user not found', 404));
    }

    // Role-based permission check
    if (!isChatAllowed(currentUserRole, recipient.role)) {
      return next(
        createError(
          `Communication between ${currentUserRole} and ${recipient.role} is not permitted`,
          403
        )
      );
    }

    // Check if direct conversation already exists between these 2 users
    const existing = await prisma.chatConversation.findFirst({
      where: {
        conversationType: 'DIRECT',
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              include: { employee: { include: { department: true } } },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existing) {
      const otherParticipantObj = existing.participants.find((p) => p.userId !== currentUserId);
      const otherUser = otherParticipantObj ? formatUserDisplay(otherParticipantObj.user) : null;
      return res.json({
        success: true,
        data: {
          id: existing.id,
          conversationType: existing.conversationType,
          title: otherUser?.name || 'Direct Chat',
          description: null,
          avatarUrl: otherUser?.avatar || null,
          createdById: null,
          groupTheme: null,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          otherUser,
          participants: existing.participants.map((p) => formatUserDisplay(p.user)),
          lastMessage: existing.messages[0] || null,
          unreadCount: 0,
        },
      });
    }

    // Create new conversation with 2 participants
    const conversation = await prisma.chatConversation.create({
      data: {
        conversationType: 'DIRECT',
        participants: {
          create: [
            { userId: currentUserId },
            { userId: recipientId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: { employee: { include: { department: true } } },
            },
          },
        },
      },
    });

    const otherUser = formatUserDisplay(recipient);

    res.status(201).json({
      success: true,
      data: {
        id: conversation.id,
        conversationType: conversation.conversationType,
        title: otherUser?.name || 'Direct Chat',
        description: null,
        avatarUrl: otherUser?.avatar || null,
        createdById: null,
        groupTheme: null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        otherUser,
        participants: conversation.participants.map((p) => formatUserDisplay(p.user)),
        lastMessage: null,
        unreadCount: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// POST /api/chat/groups - Create a Group Conversation (Admin Only)
const createGroupSchema = z.object({
  title: z.string().min(2, 'Group name must be at least 2 characters'),
  description: z.string().optional(),
  avatarUrl: z.string().optional().nullable(),
  memberIds: z.array(z.string()).min(1, 'Select at least one group member'),
  themeId: z.string().optional(),
});

export const createGroupConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    if (currentUserRole !== 'ADMIN') {
      return next(createError('Only Administrators are authorized to create group chats', 403));
    }

    const { title, description, avatarUrl, memberIds, themeId } = createGroupSchema.parse(req.body);

    const allMemberIds = Array.from(new Set([currentUserId, ...memberIds]));
    const themeConfig = THEME_PRESETS[themeId || 'classic-blue'] || DEFAULT_THEME;

    const conversation = await prisma.chatConversation.create({
      data: {
        conversationType: 'GROUP',
        title: title.trim(),
        description: description?.trim() || null,
        avatarUrl: avatarUrl || null,
        createdById: currentUserId,
        groupTheme: themeConfig as any,
        participants: {
          create: allMemberIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: { employee: { include: { department: true } } },
            },
          },
        },
      },
    });

    // Create a welcoming system log message
    const welcomeMsg = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: currentUserId,
        messageType: 'TEXT',
        messageContent: `📢 Group "${title.trim()}" created by Administrator`,
      },
    });

    const formattedParticipants = conversation.participants.map((p) => formatUserDisplay(p.user));

    const responsePayload = {
      id: conversation.id,
      conversationType: conversation.conversationType,
      title: conversation.title,
      description: conversation.description,
      avatarUrl: conversation.avatarUrl,
      createdById: conversation.createdById,
      groupTheme: conversation.groupTheme,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      otherUser: null,
      participants: formattedParticipants,
      lastMessage: welcomeMsg,
      unreadCount: 0,
    };

    // Notify all group members in real time
    allMemberIds.forEach((uid) => {
      emitToUser(uid, 'conversation_created', responsePayload);
    });

    res.status(201).json({
      success: true,
      data: responsePayload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// PUT /api/chat/groups/:id/theme - Customize Group Theme (Admin Only)
const updateGroupThemeSchema = z.object({
  themeId: z.string(),
  mode: z.enum(['light', 'dark']).default('light'),
  primaryColor: z.string().optional(),
  bubbleColor: z.string().optional(),
  bgPattern: z.string().optional(),
});

export const updateGroupTheme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const currentUserRole = req.user!.role;

    if (currentUserRole !== 'ADMIN') {
      return next(createError('Only Administrators can customize group chat themes', 403));
    }

    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conv || conv.conversationType !== 'GROUP') {
      return next(createError('Group conversation not found', 404));
    }

    const data = updateGroupThemeSchema.parse(req.body);
    const basePreset = THEME_PRESETS[data.themeId] || DEFAULT_THEME;

    const finalTheme = {
      id: data.themeId,
      name: basePreset.name,
      mode: data.mode,
      primaryColor: data.primaryColor || basePreset.primaryColor,
      bubbleColor: data.bubbleColor || basePreset.bubbleColor,
      bgPattern: data.bgPattern || basePreset.bgPattern,
    };

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { groupTheme: finalTheme as any },
    });

    // Broadcast theme change in real-time
    emitToConversation(conversationId, 'group_theme_updated', {
      conversationId,
      groupTheme: finalTheme,
    });

    conv.participants.forEach((p) => {
      emitToUser(p.userId, 'group_theme_updated', {
        conversationId,
        groupTheme: finalTheme,
      });
    });

    res.json({
      success: true,
      data: finalTheme,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// GET /api/chat/theme - Get User's Personal Theme
export const getUserTheme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;

    const userTheme = await prisma.userChatTheme.findUnique({
      where: { userId: currentUserId },
    });

    if (!userTheme) {
      return res.json({
        success: true,
        data: DEFAULT_THEME,
      });
    }

    const basePreset = THEME_PRESETS[userTheme.themeId] || DEFAULT_THEME;
    res.json({
      success: true,
      data: {
        id: userTheme.themeId,
        name: basePreset.name,
        mode: userTheme.mode as any,
        primaryColor: userTheme.primaryColor || basePreset.primaryColor,
        bubbleColor: userTheme.bubbleColor || basePreset.bubbleColor,
        bgPattern: userTheme.bgPattern || basePreset.bgPattern,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/chat/theme - Update User's Personal Theme
export const updateUserTheme = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const data = updateGroupThemeSchema.parse(req.body);

    const basePreset = THEME_PRESETS[data.themeId] || DEFAULT_THEME;
    const primaryColor = data.primaryColor || basePreset.primaryColor;
    const bubbleColor = data.bubbleColor || basePreset.bubbleColor;
    const bgPattern = data.bgPattern || basePreset.bgPattern;

    const saved = await prisma.userChatTheme.upsert({
      where: { userId: currentUserId },
      create: {
        userId: currentUserId,
        themeId: data.themeId,
        mode: data.mode,
        primaryColor,
        bubbleColor,
        bgPattern,
      },
      update: {
        themeId: data.themeId,
        mode: data.mode,
        primaryColor,
        bubbleColor,
        bgPattern,
      },
    });

    res.json({
      success: true,
      data: {
        id: saved.themeId,
        name: basePreset.name,
        mode: saved.mode,
        primaryColor: saved.primaryColor,
        bubbleColor: saved.bubbleColor,
        bgPattern: saved.bgPattern,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// GET /api/chat/calls/history - Get Call Records
export const getCallHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const conversationId = req.query.conversationId as string | undefined;

    const whereClause: any = {
      OR: [
        { callerId: currentUserId },
        { participants: { some: { userId: currentUserId } } },
      ],
    };

    if (conversationId) {
      whereClause.conversationId = conversationId;
    }

    const calls = await prisma.callRecord.findMany({
      where: whereClause,
      include: {
        caller: {
          include: { employee: { include: { department: true } } },
        },
        conversation: {
          select: {
            id: true,
            title: true,
            conversationType: true,
            avatarUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              include: { employee: { include: { department: true } } },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const formatted = calls.map((c) => ({
      id: c.id,
      conversationId: c.conversationId,
      callerId: c.callerId,
      caller: formatUserDisplay(c.caller),
      callType: c.callType,
      isGroup: c.isGroup,
      status: c.status,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      durationSeconds: c.durationSeconds,
      conversation: c.conversation,
      participants: c.participants.map((p) => ({
        id: p.id,
        status: p.status,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        user: formatUserDisplay(p.user),
      })),
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/conversations/:id/messages - Get message history
export const getConversationMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before as string | undefined;

    // Check participant
    const isParticipant = await prisma.chatParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
    });

    if (!isParticipant && req.user!.role !== 'ADMIN') {
      return next(createError('Not authorized to access this conversation', 403));
    }

    const whereClause: any = { conversationId };
    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: {
              select: {
                id: true,
                name: true,
                profilePhoto: true,
                employeeId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: formatUserDisplay(m.sender),
      messageType: m.messageType,
      messageContent: m.isDeleted ? 'This message was deleted' : m.messageContent,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentSize: m.attachmentSize,
      attachmentType: m.attachmentType,
      duration: extractDurationFromAttachment(m.attachmentType, m.attachmentName, m.messageContent),
      createdAt: m.createdAt,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      isDeleted: m.isDeleted,
      isPinned: m.isPinned,
      pinnedAt: m.pinnedAt,
      isForwarded: m.isForwarded,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/conversations/:id/messages - Send a message
const sendMessageSchema = z.object({
  messageContent: z.string().optional().default(''),
  messageType: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'ORDER_ALERT', 'LEAVE_NOTICE', 'CALL_LOG', 'AUDIO', 'VIDEO']).default('TEXT'),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  attachmentSize: z.number().optional().nullable(),
  attachmentType: z.string().optional().nullable(),
  duration: z.number().optional().nullable(),
});

// Helper to extract audio duration from metadata
export const extractDurationFromAttachment = (
  attachmentType?: string | null,
  attachmentName?: string | null,
  content?: string | null
): number | null => {
  if (attachmentType) {
    const match = attachmentType.match(/duration=(\d+(\.\d+)?)/);
    if (match) return Math.round(parseFloat(match[1]));
  }
  if (attachmentName) {
    const match = attachmentName.match(/[-_](\d+)s\./);
    if (match) return parseInt(match[1], 10);
  }
  if (content) {
    const match = content.match(/\((\d+):(\d+)\)/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
  }
  return null;
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    const data = sendMessageSchema.parse(req.body);

    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!conv) {
      return next(createError('Conversation not found', 404));
    }

    const isParticipant = conv.participants.some((p) => p.userId === currentUserId);
    if (!isParticipant && currentUserRole !== 'ADMIN') {
      return next(createError('You are not a participant in this conversation', 403));
    }

    const recipients = conv.participants.filter((p) => p.userId !== currentUserId);

    // If DIRECT conversation, verify role-based permissions
    if (conv.conversationType === 'DIRECT') {
      for (const rec of recipients) {
        if (!isChatAllowed(currentUserRole, rec.user.role)) {
          return next(
            createError(
              `Communication with user ${rec.user.email} (${rec.user.role}) is not permitted`,
              403
            )
          );
        }
      }
    }

    // Check delivery status: delivered if at least one recipient is online
    const isAnyRecipientOnline = recipients.some((r) => isUserOnline(r.userId));
    const now = new Date();
    const deliveredAt = isAnyRecipientOnline ? now : null;

    // Handle duration in attachmentType and default message content
    let finalAttachmentType = data.attachmentType || null;
    if (data.duration && (data.messageType === 'AUDIO' || data.messageType === 'VIDEO')) {
      if (finalAttachmentType) {
        if (!finalAttachmentType.includes('duration=')) {
          finalAttachmentType = `${finalAttachmentType};duration=${data.duration}`;
        }
      } else {
        finalAttachmentType = `audio/webm;duration=${data.duration}`;
      }
    }

    let finalMessageContent = (data.messageContent || '').trim();
    if (!finalMessageContent) {
      if (data.messageType === 'AUDIO') {
        const mins = Math.floor((data.duration || 0) / 60);
        const secs = Math.floor((data.duration || 0) % 60);
        const timeStr = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
        finalMessageContent = `🎤 Voice Message (${timeStr})`;
      } else if (data.attachmentName) {
        finalMessageContent = data.attachmentName;
      }
    }

    // Create message in DB
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: currentUserId,
        messageType: data.messageType,
        messageContent: finalMessageContent,
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
        attachmentSize: data.attachmentSize || null,
        attachmentType: finalAttachmentType,
        deliveredAt,
      },
      include: {
        sender: {
          include: {
            employee: {
              include: { department: true },
            },
          },
        },
      },
    });

    // Update conversation updatedAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: now },
    });

    // Create notifications for offline / background recipients
    for (const rec of recipients) {
      await prisma.chatNotification.create({
        data: {
          recipientId: rec.userId,
          messageId: message.id,
          isRead: false,
        },
      });
    }

    const calculatedDuration = data.duration || extractDurationFromAttachment(message.attachmentType, message.attachmentName, message.messageContent);

    const formattedSender = formatUserDisplay(message.sender);
    const messagePayload = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: formattedSender,
      messageType: message.messageType,
      messageContent: message.messageContent,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      attachmentSize: message.attachmentSize,
      attachmentType: message.attachmentType,
      duration: calculatedDuration,
      createdAt: message.createdAt.toISOString(),
      deliveredAt: message.deliveredAt ? message.deliveredAt.toISOString() : null,
      readAt: null,
      isDeleted: false,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt ? message.pinnedAt.toISOString() : null,
      isForwarded: message.isForwarded,
    };

    // Broadcast to conversation room
    emitToConversation(conversationId, 'receive_message', messagePayload);

    // Also emit to each recipient's personal room for global notification popups
    recipients.forEach((rec) => {
      emitToUser(rec.userId, 'receive_message', messagePayload);
      emitToUser(rec.userId, 'new_notification', {
        id: message.id,
        conversationId,
        conversationType: conv.conversationType,
        groupTitle: conv.title,
        sender: formattedSender,
        messageType: message.messageType,
        messageContent: message.messageContent,
        createdAt: message.createdAt.toISOString(),
      });
    });

    res.status(201).json({
      success: true,
      data: messagePayload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// POST /api/chat/conversations/:id/read - Mark messages as read
export const markConversationAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user!.id;
    const now = new Date();

    // Verify participation
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return next(createError('Not authorized', 403));
    }

    // Find all unread messages where current user is recipient
    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        readAt: null,
      },
      select: { id: true, senderId: true },
    });

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((m) => m.id);

      await prisma.chatMessage.updateMany({
        where: { id: { in: messageIds } },
        data: { readAt: now, deliveredAt: now },
      });

      // Mark chat notifications as read
      await prisma.chatNotification.updateMany({
        where: {
          messageId: { in: messageIds },
          recipientId: currentUserId,
        },
        data: { isRead: true },
      });

      // Update participant lastReadAt
      if (participant) {
        await prisma.chatParticipant.update({
          where: { id: participant.id },
          data: { lastReadAt: now },
        });
      }

      // Notify senders in real time
      const senderIds = Array.from(new Set(unreadMessages.map((m) => m.senderId)));
      senderIds.forEach((senderId) => {
        emitToUser(senderId, 'messages_read', {
          conversationId,
          readerId: currentUserId,
          messageIds,
          readAt: now.toISOString(),
        });
      });
    }

    res.json({
      success: true,
      count: unreadMessages.length,
      readAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/unread-count - Total unread message count
export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;

    const userConversations = await prisma.chatParticipant.findMany({
      where: { userId: currentUserId },
      select: { conversationId: true },
    });

    const conversationIds = userConversations.map((c) => c.conversationId);
    if (conversationIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const count = await prisma.chatMessage.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: currentUserId },
        readAt: null,
      },
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/chat/messages/:id - Delete / Moderate message
export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });

    if (!message) {
      return next(createError('Message not found', 404));
    }

    // Only sender OR Admin can delete/moderate
    if (message.senderId !== currentUserId && currentUserRole !== 'ADMIN') {
      return next(createError('You are not authorized to delete this message', 403));
    }

    // Soft delete message
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        messageContent: 'This message was deleted',
        attachmentUrl: null,
        attachmentName: null,
      },
    });

    // Notify conversation room and participants
    emitToConversation(message.conversationId, 'message_deleted', {
      messageId: message.id,
      conversationId: message.conversationId,
    });

    message.conversation.participants.forEach((p) => {
      emitToUser(p.userId, 'message_deleted', {
        messageId: message.id,
        conversationId: message.conversationId,
      });
    });

    res.json({
      success: true,
      message: 'Message deleted successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/chat/messages/:id/pin - Pin or unpin a message
export const pinMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: { participants: true },
        },
      },
    });

    if (!message) {
      return next(createError('Message not found', 404));
    }

    const isParticipant = message.conversation.participants.some((p) => p.userId === currentUserId);
    if (!isParticipant && currentUserRole !== 'ADMIN') {
      return next(createError('You are not authorized to pin messages in this conversation', 403));
    }

    const nextPinnedState = !message.isPinned;
    const now = new Date();

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isPinned: nextPinnedState,
        pinnedAt: nextPinnedState ? now : null,
      },
    });

    const eventPayload = {
      messageId: updated.id,
      conversationId: updated.conversationId,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
    };

    emitToConversation(updated.conversationId, 'message_pinned', eventPayload);
    message.conversation.participants.forEach((p) => {
      emitToUser(p.userId, 'message_pinned', eventPayload);
    });

    res.json({
      success: true,
      message: nextPinnedState ? 'Message pinned' : 'Message unpinned',
      data: {
        id: updated.id,
        conversationId: updated.conversationId,
        isPinned: updated.isPinned,
        pinnedAt: updated.pinnedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/messages/:id/forward - Forward message to conversations/users
const forwardSchema = z.object({
  targetConversationIds: z.array(z.string()).optional().default([]),
  targetUserIds: z.array(z.string()).optional().default([]),
});

export const forwardMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    const { targetConversationIds, targetUserIds } = forwardSchema.parse(req.body);

    if (targetConversationIds.length === 0 && targetUserIds.length === 0) {
      return next(createError('Please specify at least one target conversation or user', 400));
    }

    const sourceMessage = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!sourceMessage) {
      return next(createError('Source message not found', 404));
    }

    if (sourceMessage.isDeleted) {
      return next(createError('Cannot forward a deleted message', 400));
    }

    // Resolve all target conversation IDs
    const resolvedConversationIds = new Set<string>(targetConversationIds);

    // For any targetUserIds, find or create direct conversation
    for (const targetUserId of targetUserIds) {
      if (targetUserId === currentUserId) continue;

      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) continue;

      if (!isChatAllowed(currentUserRole, targetUser.role)) continue;

      let conv = await prisma.chatConversation.findFirst({
        where: {
          conversationType: 'DIRECT',
          AND: [
            { participants: { some: { userId: currentUserId } } },
            { participants: { some: { userId: targetUserId } } },
          ],
        },
      });

      if (!conv) {
        conv = await prisma.chatConversation.create({
          data: {
            conversationType: 'DIRECT',
            participants: {
              create: [{ userId: currentUserId }, { userId: targetUserId }],
            },
          },
        });
      }

      resolvedConversationIds.add(conv.id);
    }

    const forwardedList = [];
    const now = new Date();

    for (const convId of resolvedConversationIds) {
      const conv = await prisma.chatConversation.findUnique({
        where: { id: convId },
        include: {
          participants: { include: { user: true } },
        },
      });

      if (!conv) continue;
      const isParticipant = conv.participants.some((p) => p.userId === currentUserId);
      if (!isParticipant && currentUserRole !== 'ADMIN') continue;

      const recipients = conv.participants.filter((p) => p.userId !== currentUserId);
      const isAnyRecipientOnline = recipients.some((r) => isUserOnline(r.userId));

      const newMsg = await prisma.chatMessage.create({
        data: {
          conversationId: convId,
          senderId: currentUserId,
          messageType: sourceMessage.messageType,
          messageContent: sourceMessage.messageContent,
          attachmentUrl: sourceMessage.attachmentUrl,
          attachmentName: sourceMessage.attachmentName,
          attachmentSize: sourceMessage.attachmentSize,
          attachmentType: sourceMessage.attachmentType,
          isForwarded: true,
          deliveredAt: isAnyRecipientOnline ? now : null,
        },
        include: {
          sender: {
            include: { employee: { include: { department: true } } },
          },
        },
      });

      await prisma.chatConversation.update({
        where: { id: convId },
        data: { updatedAt: now },
      });

      // Create notifications for recipients
      for (const rec of recipients) {
        await prisma.chatNotification.create({
          data: {
            recipientId: rec.userId,
            messageId: newMsg.id,
            isRead: false,
          },
        });
      }

      const formattedSender = formatUserDisplay(newMsg.sender);
      const messagePayload = {
        id: newMsg.id,
        conversationId: newMsg.conversationId,
        senderId: newMsg.senderId,
        sender: formattedSender,
        messageType: newMsg.messageType,
        messageContent: newMsg.messageContent,
        attachmentUrl: newMsg.attachmentUrl,
        attachmentName: newMsg.attachmentName,
        attachmentSize: newMsg.attachmentSize,
        attachmentType: newMsg.attachmentType,
        duration: extractDurationFromAttachment(newMsg.attachmentType, newMsg.attachmentName, newMsg.messageContent),
        createdAt: newMsg.createdAt.toISOString(),
        deliveredAt: newMsg.deliveredAt ? newMsg.deliveredAt.toISOString() : null,
        readAt: null,
        isDeleted: false,
        isPinned: false,
        pinnedAt: null,
        isForwarded: true,
      };

      emitToConversation(convId, 'receive_message', messagePayload);
      recipients.forEach((rec) => {
        emitToUser(rec.userId, 'receive_message', messagePayload);
        emitToUser(rec.userId, 'new_notification', {
          id: newMsg.id,
          conversationId: convId,
          conversationType: conv.conversationType,
          groupTitle: conv.title,
          sender: formattedSender,
          messageType: newMsg.messageType,
          messageContent: newMsg.messageContent,
          createdAt: newMsg.createdAt.toISOString(),
        });
      });

      forwardedList.push(messagePayload);
    }

    res.status(201).json({
      success: true,
      message: `Message forwarded to ${forwardedList.length} conversation(s)`,
      data: forwardedList,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// Helper function to send direct chat message programmatically (e.g. for leave notices)
export const sendDirectChatMessage = async ({
  senderUserId,
  recipientUserId,
  messageContent,
  messageType = 'TEXT',
}: {
  senderUserId: string;
  recipientUserId: string;
  messageContent: string;
  messageType?: 'TEXT' | 'ORDER_ALERT' | 'LEAVE_NOTICE';
}) => {
  try {
    if (!senderUserId || !recipientUserId || senderUserId === recipientUserId) {
      return null;
    }

    let conv = await prisma.chatConversation.findFirst({
      where: {
        conversationType: 'DIRECT',
        AND: [
          { participants: { some: { userId: senderUserId } } },
          { participants: { some: { userId: recipientUserId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { include: { employee: { include: { department: true } } } } },
        },
      },
    });

    if (!conv) {
      conv = await prisma.chatConversation.create({
        data: {
          conversationType: 'DIRECT',
          participants: {
            create: [{ userId: senderUserId }, { userId: recipientUserId }],
          },
        },
        include: {
          participants: {
            include: { user: { include: { employee: { include: { department: true } } } } },
          },
        },
      });
    }

    const now = new Date();
    const recipientOnline = isUserOnline(recipientUserId);

    const message = await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId: senderUserId,
        messageType: messageType as any,
        messageContent: messageContent.trim(),
        deliveredAt: recipientOnline ? now : null,
      },
      include: {
        sender: {
          include: {
            employee: {
              include: { department: true },
            },
          },
        },
      },
    });

    await prisma.chatConversation.update({
      where: { id: conv.id },
      data: { updatedAt: now },
    });

    await prisma.chatNotification.create({
      data: {
        recipientId: recipientUserId,
        messageId: message.id,
        isRead: false,
      },
    });

    const formattedSender = formatUserDisplay(message.sender);
    const messagePayload = {
      id: message.id,
      conversationId: conv.id,
      senderId: message.senderId,
      sender: formattedSender,
      messageType: message.messageType,
      messageContent: message.messageContent,
      attachmentUrl: null,
      attachmentName: null,
      attachmentSize: null,
      attachmentType: null,
      createdAt: message.createdAt.toISOString(),
      deliveredAt: message.deliveredAt ? message.deliveredAt.toISOString() : null,
      readAt: null,
      isDeleted: false,
      isPinned: false,
      pinnedAt: null,
      isForwarded: false,
    };

    emitToConversation(conv.id, 'receive_message', messagePayload);
    emitToUser(recipientUserId, 'receive_message', messagePayload);
    emitToUser(recipientUserId, 'new_notification', {
      id: message.id,
      conversationId: conv.id,
      conversationType: 'DIRECT',
      groupTitle: null,
      sender: formattedSender,
      messageType: message.messageType,
      messageContent: message.messageContent,
      createdAt: message.createdAt.toISOString(),
    });

    return messagePayload;
  } catch (err) {
    console.error('Error sending direct chat message:', err);
    return null;
  }
};

// GET /api/chat/notifications - Get unread chat notifications
export const getChatNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const notifications = await prisma.chatNotification.findMany({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
      include: {
        message: {
          include: {
            sender: {
              include: { employee: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const formatted = notifications.map((n) => ({
      id: n.id,
      messageId: n.messageId,
      conversationId: n.message.conversationId,
      sender: formatUserDisplay(n.message.sender),
      messageContent: n.message.messageContent,
      messageType: n.message.messageType,
      createdAt: n.createdAt,
      isRead: n.isRead,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/notifications/mark-all-read
export const markAllNotificationsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;

    await prisma.chatNotification.updateMany({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};
