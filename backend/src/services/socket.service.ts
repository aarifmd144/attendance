import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { formatUserDisplay } from '../utils/chatUtils';

interface SocketUser {
  id: string;
  email: string;
  role: string;
}

let io: Server | null = null;
const userSockets = new Map<string, Set<string>>();
const socketToUser = new Map<string, string>();
// Track active calls for sockets to handle abrupt disconnects
const activeUserCalls = new Map<string, Set<string>>(); // userId -> Set of callIds

export const initSocketServer = (httpServer: HttpServer) => {
  const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = rawOrigins.split(',').map((url) => url.trim().replace(/\/+$/, ''));

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(normalized) ||
          process.env.NODE_ENV !== 'production'
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked socket origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Handshake Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (Array.isArray(token)) {
        token = token[0];
      }

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication error: Token missing'));
      }

      const secret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token, secret) as SocketUser;

      // Verify user in DB
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
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
              department: { select: { name: true } },
            },
          },
        },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.data.user = user;
      next();
    } catch (err: any) {
      return next(new Error(`Authentication error: ${err.message || 'Invalid token'}`));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as any;
    if (!user) return;

    const userId = user.id;

    // Register socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const isFirstConnection = userSockets.get(userId)!.size === 0;
    userSockets.get(userId)!.add(socket.id);
    socketToUser.set(socket.id, userId);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Update lastSeenAt
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});

    // If first socket connection for this user, broadcast user_online
    if (isFirstConnection) {
      socket.broadcast.emit('user_online', {
        userId,
        lastSeenAt: null,
      });

      // Mark pending undelivered messages to this user as DELIVERED
      try {
        const userConversations = await prisma.chatParticipant.findMany({
          where: { userId },
          select: { conversationId: true },
        });

        const conversationIds = userConversations.map((c) => c.conversationId);
        if (conversationIds.length > 0) {
          const undeliveredMessages = await prisma.chatMessage.findMany({
            where: {
              conversationId: { in: conversationIds },
              senderId: { not: userId },
              deliveredAt: null,
            },
            select: { id: true, senderId: true, conversationId: true },
          });

          if (undeliveredMessages.length > 0) {
            const now = new Date();
            const messageIds = undeliveredMessages.map((m) => m.id);

            await prisma.chatMessage.updateMany({
              where: { id: { in: messageIds } },
              data: { deliveredAt: now },
            });

            // Notify senders that messages were delivered
            undeliveredMessages.forEach((msg) => {
              emitToUser(msg.senderId, 'message_delivered', {
                messageId: msg.id,
                conversationId: msg.conversationId,
                deliveredAt: now.toISOString(),
              });
            });
          }
        }
      } catch (err) {
        console.error('Error marking messages delivered on connect:', err);
      }
    }

    // Send currently online user list to this client
    socket.emit('online_users', Array.from(userSockets.keys()));

    // Join conversation room
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      try {
        if (!data?.conversationId) return;

        // Verify participant
        const isParticipant = await prisma.chatParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId: data.conversationId,
              userId,
            },
          },
        });

        if (isParticipant || user.role === 'ADMIN') {
          socket.join(`conversation:${data.conversationId}`);
        }
      } catch (err) {
        console.error('Error joining conversation room:', err);
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      if (data?.conversationId) {
        socket.leave(`conversation:${data.conversationId}`);
      }
    });

    // Typing start
    socket.on('typing_start', (data: { conversationId: string; receiverId?: string }) => {
      if (!data?.conversationId) return;
      if (data.receiverId) {
        emitToUser(data.receiverId, 'typing_start', {
          conversationId: data.conversationId,
          userId,
        });
      } else {
        socket.to(`conversation:${data.conversationId}`).emit('typing_start', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });

    // Typing stop
    socket.on('typing_stop', (data: { conversationId: string; receiverId?: string }) => {
      if (!data?.conversationId) return;
      if (data.receiverId) {
        emitToUser(data.receiverId, 'typing_stop', {
          conversationId: data.conversationId,
          userId,
        });
      } else {
        socket.to(`conversation:${data.conversationId}`).emit('typing_stop', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });

    // ============================================================
    // 1-ON-1 AUDIO / VIDEO CALLING SIGNALING
    // ============================================================

    // 1. Initiate 1-on-1 Call (Disabled)
    socket.on(
      'call_user',
      async (
        _data: {
          conversationId: string;
          recipientId: string;
          callType: 'AUDIO' | 'VIDEO';
          offer: any;
        },
        callback?: (res: any) => void
      ) => {
        callback?.({ success: false, message: 'Calling facility is disabled.' });
      }
    );

    // 2. Accept 1-on-1 Call
    socket.on(
      'call_accepted',
      async (data: { callId: string; callerId: string; answer: any }) => {
        try {
          if (!data?.callId || !data?.callerId) return;

          // Update call record
          await prisma.callRecord.update({
            where: { id: data.callId },
            data: { status: 'ONGOING' },
          }).catch(() => {});

          await prisma.callParticipant.updateMany({
            where: { callId: data.callId, userId },
            data: { status: 'JOINED', joinedAt: new Date() },
          }).catch(() => {});

          // Track active call
          if (!activeUserCalls.has(userId)) activeUserCalls.set(userId, new Set());
          activeUserCalls.get(userId)!.add(data.callId);

          emitToUser(data.callerId, 'call_accepted', {
            callId: data.callId,
            answer: data.answer,
            responderId: userId,
          });
        } catch (err) {
          console.error('call_accepted error:', err);
        }
      }
    );

    // 3. Reject 1-on-1 Call
    socket.on(
      'call_rejected',
      async (data: { callId: string; callerId: string; conversationId: string; reason?: string; callType?: 'AUDIO' | 'VIDEO' }) => {
        try {
          if (!data?.callId) return;

          await prisma.callRecord.update({
            where: { id: data.callId },
            data: { status: 'REJECTED', endedAt: new Date() },
          }).catch(() => {});

          await prisma.callParticipant.updateMany({
            where: { callId: data.callId, userId },
            data: { status: 'REJECTED' },
          }).catch(() => {});

          emitToUser(data.callerId, 'call_rejected', {
            callId: data.callId,
            reason: data.reason || 'declined',
          });

          // Log missed/declined call in conversation
          if (data.conversationId) {
            const callKind = data.callType === 'VIDEO' ? 'Video' : 'Audio';
            const logMsg = await prisma.chatMessage.create({
              data: {
                conversationId: data.conversationId,
                senderId: data.callerId,
                messageType: 'CALL_LOG',
                messageContent: `❌ Missed ${callKind} Call`,
              },
              include: {
                sender: {
                  include: { employee: { include: { department: true } } },
                },
              },
            });

            const formattedMsg = {
              id: logMsg.id,
              conversationId: logMsg.conversationId,
              senderId: logMsg.senderId,
              sender: formatUserDisplay(logMsg.sender),
              messageType: logMsg.messageType,
              messageContent: logMsg.messageContent,
              createdAt: logMsg.createdAt.toISOString(),
              deliveredAt: new Date().toISOString(),
              readAt: null,
              isDeleted: false,
            };

            emitToConversation(data.conversationId, 'receive_message', formattedMsg);
            emitToUser(userId, 'receive_message', formattedMsg);
            emitToUser(data.callerId, 'receive_message', formattedMsg);
          }
        } catch (err) {
          console.error('call_rejected error:', err);
        }
      }
    );

    // 4. ICE Candidate exchange
    socket.on(
      'call_candidate',
      (data: { targetUserId: string; candidate: any; callId: string }) => {
        if (!data?.targetUserId || !data?.candidate) return;
        emitToUser(data.targetUserId, 'call_candidate', {
          candidate: data.candidate,
          callId: data.callId,
          fromUserId: userId,
        });
      }
    );

    // 5. End 1-on-1 Call
    socket.on(
      'call_end',
      async (data: {
        callId: string;
        conversationId: string;
        recipientId?: string;
        durationSeconds?: number;
        callType?: 'AUDIO' | 'VIDEO';
      }) => {
        try {
          if (!data?.callId) return;

          activeUserCalls.get(userId)?.delete(data.callId);
          if (data.recipientId) activeUserCalls.get(data.recipientId)?.delete(data.callId);

          const duration = data.durationSeconds || 0;
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const durationLabel = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

          await prisma.callRecord.update({
            where: { id: data.callId },
            data: {
              status: 'COMPLETED',
              endedAt: new Date(),
              durationSeconds: duration,
            },
          }).catch(() => {});

          await prisma.callParticipant.updateMany({
            where: { callId: data.callId, leftAt: null },
            data: { leftAt: new Date(), durationSeconds: duration },
          }).catch(() => {});

          if (data.recipientId) {
            emitToUser(data.recipientId, 'call_ended', {
              callId: data.callId,
              durationSeconds: duration,
            });
          }

          // Create call log message in chat thread
          if (data.conversationId && duration > 0) {
            const callKind = data.callType === 'VIDEO' ? '📹 Video' : '📞 Audio';
            const logMsg = await prisma.chatMessage.create({
              data: {
                conversationId: data.conversationId,
                senderId: userId,
                messageType: 'CALL_LOG',
                messageContent: `${callKind} Call ended • ${durationLabel}`,
              },
              include: {
                sender: {
                  include: { employee: { include: { department: true } } },
                },
              },
            });

            const formattedMsg = {
              id: logMsg.id,
              conversationId: logMsg.conversationId,
              senderId: logMsg.senderId,
              sender: formatUserDisplay(logMsg.sender),
              messageType: logMsg.messageType,
              messageContent: logMsg.messageContent,
              createdAt: logMsg.createdAt.toISOString(),
              deliveredAt: new Date().toISOString(),
              readAt: null,
              isDeleted: false,
            };

            emitToConversation(data.conversationId, 'receive_message', formattedMsg);
            emitToUser(userId, 'receive_message', formattedMsg);
            if (data.recipientId) emitToUser(data.recipientId, 'receive_message', formattedMsg);
          }
        } catch (err) {
          console.error('call_end error:', err);
        }
      }
    );

    // ============================================================
    // GROUP AUDIO / VIDEO CALLING SIGNALING
    // ============================================================

    // 1. Start Group Call (Disabled)
    socket.on(
      'group_call_start',
      async (
        _data: { conversationId: string; callType: 'AUDIO' | 'VIDEO' },
        callback?: (res: any) => void
      ) => {
        callback?.({ success: false, message: 'Calling facility is disabled.' });
      }
    );

    // 2. Join Group Call
    socket.on(
      'group_call_join',
      async (
        data: { callId: string; conversationId: string },
        callback?: (res: any) => void
      ) => {
        try {
          if (!data?.callId) {
            callback?.({ success: false, message: 'Missing callId' });
            return;
          }

          const call = await prisma.callRecord.findUnique({
            where: { id: data.callId },
            include: { conversation: { include: { participants: true } } },
          });

          if (!call || call.status === 'COMPLETED' || call.status === 'CANCELLED') {
            callback?.({ success: false, message: 'Call is no longer active' });
            return;
          }

          // Verify group membership
          const isMember = call.conversation.participants.some((p) => p.userId === userId);
          if (!isMember && user.role !== 'ADMIN') {
            callback?.({ success: false, message: 'Unauthorized' });
            return;
          }

          // Upsert participant
          await prisma.callParticipant.upsert({
            where: {
              callId_userId: { callId: data.callId, userId },
            },
            create: {
              callId: data.callId,
              userId,
              status: 'JOINED',
              joinedAt: new Date(),
            },
            update: {
              status: 'JOINED',
              joinedAt: new Date(),
              leftAt: null,
            },
          });

          // Join call socket room
          socket.join(`call:${data.callId}`);

          if (!activeUserCalls.has(userId)) activeUserCalls.set(userId, new Set());
          activeUserCalls.get(userId)!.add(data.callId);

          // Get all currently connected sockets in room call:callId
          const roomSockets = await io?.in(`call:${data.callId}`).fetchSockets();
          const existingParticipants: any[] = [];

          if (roomSockets) {
            for (const s of roomSockets) {
              const u = s.data.user;
              if (u && u.id !== userId) {
                existingParticipants.push({
                  id: u.id,
                  user: formatUserDisplay(u),
                });
              }
            }
          }

          // Notify existing participants that this user joined
          socket.to(`call:${data.callId}`).emit('group_call_user_joined', {
            userId,
            user: formatUserDisplay(user),
            callId: data.callId,
          });

          callback?.({
            success: true,
            callId: data.callId,
            callType: call.callType,
            existingParticipants,
          });
        } catch (err: any) {
          console.error('group_call_join error:', err);
          callback?.({ success: false, message: err.message });
        }
      }
    );

    // 3. WebRTC Signal Relay for Group Call Mesh
    socket.on(
      'group_call_signal',
      (data: { callId: string; targetUserId: string; signal: any }) => {
        if (!data?.targetUserId || !data?.signal) return;
        emitToUser(data.targetUserId, 'group_call_signal', {
          callId: data.callId,
          fromUserId: userId,
          fromUser: formatUserDisplay(user),
          signal: data.signal,
        });
      }
    );

    // 4. Speaking Indicator
    socket.on(
      'group_call_speaking',
      (data: { callId: string; isSpeaking: boolean }) => {
        if (!data?.callId) return;
        socket.to(`call:${data.callId}`).emit('group_call_speaking', {
          callId: data.callId,
          userId,
          isSpeaking: data.isSpeaking,
        });
      }
    );

    // 5. Leave Group Call
    socket.on(
      'group_call_leave',
      async (data: { callId: string; conversationId: string }) => {
        try {
          if (!data?.callId) return;

          socket.leave(`call:${data.callId}`);
          activeUserCalls.get(userId)?.delete(data.callId);

          await prisma.callParticipant.updateMany({
            where: { callId: data.callId, userId, leftAt: null },
            data: { status: 'LEFT', leftAt: new Date() },
          }).catch(() => {});

          socket.to(`call:${data.callId}`).emit('group_call_user_left', {
            callId: data.callId,
            userId,
          });
        } catch (err) {
          console.error('group_call_leave error:', err);
        }
      }
    );

    // 6. End Group Call for Everyone (Admin or Call Initiator)
    socket.on(
      'group_call_end_all',
      async (
        data: { callId: string; conversationId: string; durationSeconds?: number },
        callback?: (res: any) => void
      ) => {
        try {
          if (!data?.callId) return;

          const call = await prisma.callRecord.findUnique({
            where: { id: data.callId },
            include: {
              participants: {
                include: { user: { include: { employee: true } } },
              },
            },
          });

          if (!call) return;

          // Only Admin or Initiator can end for everyone
          if (call.callerId !== userId && user.role !== 'ADMIN') {
            callback?.({ success: false, message: 'Only initiator or admin can end call for all' });
            return;
          }

          const duration = data.durationSeconds || 0;
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const durationLabel = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

          await prisma.callRecord.update({
            where: { id: data.callId },
            data: {
              status: 'COMPLETED',
              endedAt: new Date(),
              durationSeconds: duration,
            },
          }).catch(() => {});

          await prisma.callParticipant.updateMany({
            where: { callId: data.callId, leftAt: null },
            data: { status: 'LEFT', leftAt: new Date() },
          }).catch(() => {});

          // Broadcast call ended to the call room
          io?.in(`call:${data.callId}`).emit('group_call_ended', {
            callId: data.callId,
            conversationId: data.conversationId,
            durationSeconds: duration,
          });

          // Post a summary message in the group conversation
          if (data.conversationId) {
            const count = call.participants.length || 1;
            const logContent = `👥 Group ${call.callType === 'VIDEO' ? 'Video' : 'Audio'} Call ended • ${count} participant${count > 1 ? 's' : ''} • ${durationLabel}`;

            const logMsg = await prisma.chatMessage.create({
              data: {
                conversationId: data.conversationId,
                senderId: userId,
                messageType: 'CALL_LOG',
                messageContent: logContent,
              },
              include: {
                sender: {
                  include: { employee: { include: { department: true } } },
                },
              },
            });

            const formattedMsg = {
              id: logMsg.id,
              conversationId: logMsg.conversationId,
              senderId: logMsg.senderId,
              sender: formatUserDisplay(logMsg.sender),
              messageType: logMsg.messageType,
              messageContent: logMsg.messageContent,
              createdAt: logMsg.createdAt.toISOString(),
              deliveredAt: new Date().toISOString(),
              readAt: null,
              isDeleted: false,
            };

            emitToConversation(data.conversationId, 'receive_message', formattedMsg);
          }

          callback?.({ success: true });
        } catch (err: any) {
          console.error('group_call_end_all error:', err);
          callback?.({ success: false, message: err.message });
        }
      }
    );

    // ============================================================
    // DISCONNECT
    // ============================================================
    socket.on('disconnect', async () => {
      socketToUser.delete(socket.id);
      const sockets = userSockets.get(userId);

      // Clean up any active calls this user was in
      const userCalls = activeUserCalls.get(userId);
      if (userCalls && userCalls.size > 0) {
        userCalls.forEach((callId) => {
          socket.to(`call:${callId}`).emit('group_call_user_left', {
            callId,
            userId,
          });
        });
        activeUserCalls.delete(userId);
      }

      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          const lastSeen = new Date();
          await prisma.user.update({
            where: { id: userId },
            data: { lastSeenAt: lastSeen },
          }).catch(() => {});

          io?.emit('user_offline', {
            userId,
            lastSeenAt: lastSeen.toISOString(),
          });
        }
      }
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};

export const isUserOnline = (userId: string): boolean => {
  const sockets = userSockets.get(userId);
  return !!sockets && sockets.size > 0;
};

export const getOnlineUserIds = (): string[] => {
  return Array.from(userSockets.keys());
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToUsers = (userIds: string[], event: string, data: any) => {
  if (!io) return;
  userIds.forEach((uid) => {
    io!.to(`user:${uid}`).emit(event, data);
  });
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
};
