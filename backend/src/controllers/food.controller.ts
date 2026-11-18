import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { emitToUser, emitToConversation, isUserOnline } from '../services/socket.service';
import { formatUserDisplay } from '../utils/chatUtils';

// ============================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) BUS
// ============================================================
interface SSEClient {
  id: string;
  res: Response;
  role: string;
  userId: string;
}

const sseClients = new Map<string, SSEClient>();

export const broadcastOrderEvent = (event: string, data: any) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [clientId, client] of sseClients.entries()) {
    try {
      client.res.write(payload);
    } catch (err) {
      sseClients.delete(clientId);
    }
  }
};

// GET /api/food/orders/stream (SSE Endpoint)
export const streamOrders = (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = `${req.user?.id || 'anon'}-${Date.now()}-${Math.random()}`;
  sseClients.set(clientId, {
    id: clientId,
    res,
    role: req.user?.role || '',
    userId: req.user?.id || '',
  });

  // Send initial ping
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ connected: true, timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat to keep connection open through reverse proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(clientId);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
  });
};

// ============================================================
// VALIDATION SCHEMAS
// ============================================================
const foodItemSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().min(2, 'Category is required'),
  price: z.number().positive('Price must be greater than zero'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

const createOrderSchema = z.object({
  breakTime: z.string().min(2, 'Break time is required'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      foodItemId: z.string().min(1, 'Item ID required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    })
  ).min(1, 'Order must contain at least one item'),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']),
});

// ============================================================
// FOOD ITEMS (ADMIN / PUBLIC / EMPLOYEE)
// ============================================================

// GET /api/food/items
export const getFoodItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, availableOnly } = req.query;

    const where: any = {};
    if (availableOnly === 'true') {
      where.isAvailable = true;
    }
    if (category && category !== 'ALL') {
      where.category = String(category);
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const items = await prisma.foodItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Also get distinct categories
    const allCategories = await prisma.foodItem.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.json({
      success: true,
      data: items,
      categories: allCategories.map((c) => c.category),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/food/items (Admin)
export const createFoodItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = foodItemSchema.parse(req.body);

    const item = await prisma.foodItem.create({
      data: {
        name: data.name.trim(),
        category: data.category.trim(),
        price: data.price,
        description: data.description?.trim(),
        imageUrl: data.imageUrl?.trim(),
        isAvailable: data.isAvailable ?? true,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'FOOD_ITEM_CREATED',
          entityType: 'FoodItem',
          entityId: item.id,
          description: `Admin created food item "${item.name}" (Rs.${item.price})`,
        },
      });
    }

    res.status(201).json({ success: true, data: item, message: 'Food item created successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// PUT /api/food/items/:id (Admin)
export const updateFoodItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = foodItemSchema.parse(req.body);

    const item = await prisma.foodItem.update({
      where: { id },
      data: {
        name: data.name.trim(),
        category: data.category.trim(),
        price: data.price,
        description: data.description?.trim(),
        imageUrl: data.imageUrl?.trim(),
        isAvailable: data.isAvailable ?? true,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'FOOD_ITEM_UPDATED',
          entityType: 'FoodItem',
          entityId: item.id,
          description: `Admin updated food item "${item.name}"`,
        },
      });
    }

    res.json({ success: true, data: item, message: 'Food item updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// DELETE /api/food/items/:id (Admin)
export const deleteFoodItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if item was used in any order items
    const usedCount = await prisma.foodOrderItem.count({ where: { foodItemId: id } });
    if (usedCount > 0) {
      // Just mark unavailable instead of cascade deleting order history
      const item = await prisma.foodItem.update({
        where: { id },
        data: { isAvailable: false },
      });
      return res.json({
        success: true,
        message: 'Item has historical order records, so it was marked unavailable instead of deleted.',
        data: item,
      });
    }

    await prisma.foodItem.delete({ where: { id } });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'FOOD_ITEM_DELETED',
          entityType: 'FoodItem',
          entityId: id,
          description: `Admin deleted food item ID: ${id}`,
        },
      });
    }

    res.json({ success: true, message: 'Food item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/food/items/:id/toggle (Admin or Food Owner)
export const toggleFoodItemAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const current = await prisma.foodItem.findUnique({ where: { id } });
    if (!current) return next(createError('Food item not found', 404));

    const updated = await prisma.foodItem.update({
      where: { id },
      data: { isAvailable: !current.isAvailable },
    });

    res.json({
      success: true,
      data: updated,
      message: `Item is now ${updated.isAvailable ? 'available' : 'unavailable'}`,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// AUTOMATED ORDER CHAT MESSAGING HELPERS & TIMESTAMPS
// ============================================================

export interface OrderTimestamps {
  readyAt?: string | null;
  deliveredAt?: string | null;
}

export const extractTimestampsFromNotes = (
  rawNotes?: string | null
): { cleanNotes: string; timestamps: OrderTimestamps } => {
  if (!rawNotes) return { cleanNotes: '', timestamps: {} };
  const match = rawNotes.match(/<!--TIMESTAMPS:(.*?)-->/);
  if (!match) return { cleanNotes: rawNotes.trim(), timestamps: {} };
  try {
    const timestamps = JSON.parse(match[1]);
    const cleanNotes = rawNotes.replace(/<!--TIMESTAMPS:(.*?)-->/, '').trim();
    return { cleanNotes, timestamps };
  } catch {
    return { cleanNotes: rawNotes.trim(), timestamps: {} };
  }
};

export const injectTimestampsToNotes = (
  rawNotes?: string | null,
  update: OrderTimestamps = {}
): string => {
  const { cleanNotes, timestamps } = extractTimestampsFromNotes(rawNotes);
  const merged = { ...timestamps, ...update };
  const tag = `<!--TIMESTAMPS:${JSON.stringify(merged)}-->`;
  return cleanNotes ? `${cleanNotes} ${tag}` : tag;
};

export const formatIST = (
  dateInput: Date | string | null | undefined,
  mode: 'time' | 'date' | 'datetime' = 'datetime'
): string => {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  if (mode === 'time') {
    return d
      .toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      .toUpperCase();
  }
  if (mode === 'date') {
    return d
      .toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      .replace(/\//g, '-');
  }

  const dateStr = d
    .toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    .replace(/\//g, '-');
  const timeStr = d
    .toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
  return `${dateStr} ${timeStr}`;
};

export const formatOrderResponse = (order: any) => {
  if (!order) return order;
  const { cleanNotes, timestamps } = extractTimestampsFromNotes(order.notes);
  const orderDate = formatIST(order.createdAt, 'date');
  const orderTime = formatIST(order.createdAt, 'time');
  const orderDateTime = formatIST(order.createdAt, 'datetime');

  const readyAt = timestamps.readyAt || null;
  const readyTime = readyAt ? formatIST(readyAt, 'time') : null;
  const readyDateTime = readyAt ? formatIST(readyAt, 'datetime') : null;

  const deliveredAt = timestamps.deliveredAt || null;
  const deliveryTime = deliveredAt ? formatIST(deliveredAt, 'time') : null;
  const deliveryDateTime = deliveredAt ? formatIST(deliveredAt, 'datetime') : null;

  const deliveryStatus =
    order.status === 'DELIVERED'
      ? 'Delivered'
      : order.status === 'READY'
      ? 'Delivery Pending'
      : order.status === 'CANCELLED'
      ? 'Cancelled'
      : 'In Preparation';

  return {
    ...order,
    notes: cleanNotes,
    readyAt,
    deliveredAt,
    orderDate,
    orderTime,
    orderDateTime,
    readyTime,
    readyDateTime,
    deliveryTime,
    deliveryDateTime,
    deliveryStatus,
  };
};

export const sendOrderChatMessage = async (
  senderUserId: string,
  recipientUserId: string,
  messageContent: string
) => {
  try {
    if (!senderUserId || !recipientUserId || senderUserId === recipientUserId) {
      return null;
    }

    // 1. Find or create DIRECT conversation between sender and recipient
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
          include: {
            user: {
              include: { employee: { include: { department: true } } },
            },
          },
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
            include: {
              user: {
                include: { employee: { include: { department: true } } },
              },
            },
          },
        },
      });
    }

    const now = new Date();
    const recipientOnline = isUserOnline(recipientUserId);

    // 2. Create ChatMessage of type ORDER_ALERT
    const message = await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId: senderUserId,
        messageType: 'ORDER_ALERT',
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

    // 3. Update conversation updatedAt
    await prisma.chatConversation.update({
      where: { id: conv.id },
      data: { updatedAt: now },
    });

    // 4. Create chat notification for recipient
    await prisma.chatNotification.create({
      data: {
        recipientId: recipientUserId,
        messageId: message.id,
        isRead: false,
      },
    });

    // 5. Emit real-time events via sockets
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
    };

    emitToConversation(conv.id, 'receive_message', messagePayload);
    emitToUser(recipientUserId, 'receive_message', messagePayload);
    emitToUser(senderUserId, 'receive_message', messagePayload);
    emitToUser(recipientUserId, 'new_notification', {
      id: message.id,
      conversationId: conv.id,
      conversationType: conv.conversationType,
      groupTitle: conv.title,
      sender: formattedSender,
      messageType: message.messageType,
      messageContent: message.messageContent,
      createdAt: message.createdAt.toISOString(),
    });

    return message;
  } catch (err) {
    console.error('Error sending automated order chat message:', err);
    return null;
  }
};

export const formatOrderPlacedMessage = (order: any, employee: any) => {
  const itemsList = order.items
    .map(
      (item: any) =>
        `• ${item.itemName} × ${item.quantity} (₹${item.price}) = ₹${item.subtotal}`
    )
    .join('\n');

  const { cleanNotes } = extractTimestampsFromNotes(order.notes);
  const notesLine = cleanNotes ? `\n📝 Special Note: ${cleanNotes}` : '';
  const deptLine = employee.department?.name ? `\n🏢 Department: ${employee.department.name}` : '';
  const orderDateStr = formatIST(order.createdAt, 'date');
  const orderTimeStr = formatIST(order.createdAt, 'time');

  return `🍽️ NEW FOOD ORDER PLACED

📋 Order Details:
• Order Number: #${order.orderNumber}
• Customer: ${employee.name} (${employee.employeeId})${deptLine}
• Order Date: ${orderDateStr}
• Order Time: ${orderTimeStr}
• Scheduled Break Time: ${order.breakTime}

🛒 Ordered Items:
${itemsList}

💰 Total Amount: ₹${order.totalAmount}${notesLine}
🟡 Status: PENDING (Order received by cafeteria)`;
};

export const formatOrderStatusUpdateMessage = (
  order: any,
  nextStatus: string,
  readyAt?: string | Date | null,
  deliveredAt?: string | Date | null
) => {
  const itemsSummary =
    order.items && order.items.length > 0
      ? `\n\n🛒 Ordered Items:\n` +
        order.items
          .map((i: any) => `• ${i.itemName} × ${i.quantity} (₹${i.subtotal || i.price * i.quantity})`)
          .join('\n')
      : '';

  const orderDateStr = formatIST(order.createdAt, 'date');
  const orderTimeStr = formatIST(order.createdAt, 'time');

  switch (nextStatus) {
    case 'ACCEPTED':
      return `🟢 FOOD ORDER ACCEPTED

📋 Order Details:
• Order Number: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Order Time: ${orderTimeStr}
• Scheduled Break Time: ${order.breakTime}
• Status: 🟢 ACCEPTED

💬 Cafeteria Update:
Your food order has been accepted by the cafeteria kitchen! Preparation is scheduled for your break slot.${itemsSummary}

💰 Total Amount: ₹${order.totalAmount}`;

    case 'PREPARING':
      return `🍳 FOOD ORDER BEING PREPARED

📋 Order Details:
• Order Number: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Order Time: ${orderTimeStr}
• Scheduled Break Time: ${order.breakTime}
• Status: ⏳ PREPARING

💬 Cafeteria Update:
Your order is now being freshly prepared in the cafeteria kitchen! It will be ready shortly.${itemsSummary}

💰 Total Amount: ₹${order.totalAmount}`;

    case 'READY': {
      const actualReadyTime = readyAt ? formatIST(readyAt, 'time') : formatIST(new Date(), 'time');
      return `🎉 FOOD ORDER READY FOR PICKUP!

📋 Order Details:
• Order ID: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Order Time: ${orderTimeStr}
• Food Ready Time: ${actualReadyTime}
• Delivery Status: ⏳ Delivery Pending (Awaiting Pickup)${itemsSummary}

💰 Total Amount: ₹${order.totalAmount}
📍 Pickup Location: Cafeteria Counter / Pantry
💬 Your meal is hot, fresh & ready! Please show Order ID #${order.orderNumber} to collect your meal. Enjoy!`;
    }

    case 'DELIVERED': {
      const actualDeliveryDateTime = deliveredAt ? formatIST(deliveredAt, 'datetime') : formatIST(new Date(), 'datetime');
      const actualReadyTime = readyAt ? formatIST(readyAt, 'time') : null;
      const readyLine = actualReadyTime ? `\n• Food Ready Time: ${actualReadyTime}` : '';

      return `✅ FOOD ORDER DELIVERED / COMPLETED

📋 Order Details:
• Order ID: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Order Time: ${orderTimeStr}${readyLine}
• Delivery Status: ✅ Delivered
• Delivery Date & Time: ${actualDeliveryDateTime}${itemsSummary}

💰 Total Amount: ₹${order.totalAmount}
💬 Your order has been delivered / collected. Thank you for ordering from the cafeteria! Have a wonderful meal! 🍽️`;
    }

    case 'CANCELLED':
      return `❌ FOOD ORDER CANCELLED

📋 Order Details:
• Order Number: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Status: ❌ CANCELLED

💬 Cafeteria Notice:
This food order has been cancelled. If you need any assistance, please reply to this chat or visit the cafeteria counter.${itemsSummary}

💰 Order Value: ₹${order.totalAmount}`;

    default:
      return `🍽️ FOOD ORDER STATUS UPDATE

📋 Order Details:
• Order Number: #${order.orderNumber}
• Order Date: ${orderDateStr}
• Status: ${nextStatus}${itemsSummary}

💰 Total Amount: ₹${order.totalAmount}`;
  }
};

// ============================================================
// ORDERS (EMPLOYEE)
// ============================================================

// POST /api/food/orders (Employee places order)
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) {
      return next(createError('Only registered employees can place food orders', 403));
    }

    const { breakTime, notes, items: orderItemsInput } = createOrderSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      include: { department: true, user: true },
    });
    if (!employee) {
      return next(createError('Employee profile not found', 404));
    }

    // Only active employees can place food orders
    if (employee.status !== 'ACTIVE') {
      return next(createError(`Only active employees can place food orders. Your account status is ${employee.status.toLowerCase()}.`, 403));
    }

    // Fetch food items
    const itemIds = orderItemsInput.map((i) => i.foodItemId);
    const dbItems = await prisma.foodItem.findMany({
      where: { id: { in: itemIds } },
    });

    const itemMap = new Map(dbItems.map((item) => [item.id, item]));

    // Validate availability & calculate total
    let totalAmount = 0;
    const preparedOrderItems: Array<{
      foodItemId: string;
      itemName: string;
      price: number;
      quantity: number;
      subtotal: number;
    }> = [];

    for (const input of orderItemsInput) {
      const item = itemMap.get(input.foodItemId);
      if (!item) {
        return next(createError(`Food item with id ${input.foodItemId} not found`, 400));
      }
      if (!item.isAvailable) {
        return next(createError(`Item "${item.name}" is currently out of stock`, 400));
      }

      const subtotal = item.price * input.quantity;
      totalAmount += subtotal;

      preparedOrderItems.push({
        foodItemId: item.id,
        itemName: item.name,
        price: item.price,
        quantity: input.quantity,
        subtotal,
      });
    }

    // Generate unique order number: ORD-YYYYMMDD-XXXX
    const datePart = format(new Date(), 'yyyyMMdd');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${datePart}-${randomSuffix}`;

    // Create order with items in a transaction
    const newOrder = await prisma.foodOrder.create({
      data: {
        orderNumber,
        employeeId: employee.id,
        breakTime,
        status: 'PENDING',
        totalAmount,
        notes: notes?.trim() || null,
        items: {
          create: preparedOrderItems,
        },
      },
      include: {
        employee: {
          include: { department: true },
        },
        items: {
          include: { foodItem: true },
        },
      },
    });

    // Notify Food Owner users about new incoming order
    const foodOwners = await prisma.user.findMany({
      where: { role: 'FOOD_OWNER' },
      select: { id: true },
    });

    const senderUserId = employee.user?.id || employee.userId || req.user.id;
    const orderPlacedMsg = formatOrderPlacedMessage(newOrder, employee);

    if (foodOwners.length > 0) {
      await prisma.notification.createMany({
        data: foodOwners.map((owner) => ({
          userId: owner.id,
          title: 'New Food Order Received',
          message: `Order #${newOrder.orderNumber} placed by ${employee.name} (${employee.employeeId}) for ${breakTime}. Total: Rs.${totalAmount}`,
          type: 'INFO',
          link: '/food-owner/dashboard',
        })),
      });

      // Automatically post structured order message in chat with Cafeteria (Food Owner)
      for (const owner of foodOwners) {
        await sendOrderChatMessage(senderUserId, owner.id, orderPlacedMsg);
      }
    } else {
      // Fallback: If no food owner exists, send to system administrators
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      for (const admin of admins) {
        await sendOrderChatMessage(senderUserId, admin.id, orderPlacedMsg);
      }
    }

    const formattedNewOrder = formatOrderResponse(newOrder);

    // Broadcast Real-time Event via SSE
    broadcastOrderEvent('NEW_ORDER', formattedNewOrder);

    res.status(201).json({
      success: true,
      data: formattedNewOrder,
      message: 'Your food order has been placed successfully!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// GET /api/food/orders/my-orders (Employee's orders)
export const getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) {
      return next(createError('Employee access required', 403));
    }

    const { status, limit = '20', page = '1' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { employeeId: req.user.employeeId };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [total, orders] = await Promise.all([
      prisma.foodOrder.count({ where }),
      prisma.foodOrder.findMany({
        where,
        include: {
          items: {
            include: { foodItem: true },
          },
          employee: {
            include: { department: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      success: true,
      data: orders.map(formatOrderResponse),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/food/orders/my-expenses (Employee's daily & monthly analytics)
export const getMyExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) {
      return next(createError('Employee access required', 403));
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const empId = req.user.employeeId;

    // Get today's completed/active orders (excluding CANCELLED)
    const todayOrders = await prisma.foodOrder.findMany({
      where: {
        employeeId: empId,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { not: 'CANCELLED' },
      },
    });
    const todayTotal = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Get month orders
    const monthOrders = await prisma.foodOrder.findMany({
      where: {
        employeeId: empId,
        createdAt: { gte: monthStart, lte: monthEnd },
        status: { not: 'CANCELLED' },
      },
      include: {
        items: {
          include: { foodItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const monthTotal = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Group expenses by date (YYYY-MM-DD) for chart
    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const order of monthOrders) {
      const dayKey = format(order.createdAt, 'yyyy-MM-dd');
      const curr = dailyMap.get(dayKey) || { total: 0, count: 0 };
      curr.total += order.totalAmount;
      curr.count += 1;
      dailyMap.set(dayKey, curr);
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, val]) => ({
        date,
        day: format(new Date(date), 'dd MMM'),
        total: Math.round(val.total * 100) / 100,
        ordersCount: val.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Category breakdown
    const categoryMap = new Map<string, number>();
    for (const order of monthOrders) {
      for (const item of order.items) {
        const cat = item.foodItem?.category || 'Other';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.subtotal);
      }
    }
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
    }));

    res.json({
      success: true,
      data: {
        todayTotal: Math.round(todayTotal * 100) / 100,
        monthTotal: Math.round(monthTotal * 100) / 100,
        totalOrdersThisMonth: monthOrders.length,
        dailyBreakdown,
        categoryBreakdown,
        recentOrders: monthOrders.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FOOD OWNER & ADMIN LIVE ORDER FEED
// ============================================================

// GET /api/food/orders/incoming (Food Owner / Admin dashboard)
export const getIncomingOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, date, search } = req.query;

    const where: any = {};

    // Date filter: default to today if not specified as 'all'
    if (date && date !== 'all') {
      const d = date === 'today' ? new Date() : new Date(String(date));
      if (!isNaN(d.getTime())) {
        where.createdAt = {
          gte: startOfDay(d),
          lte: endOfDay(d),
        };
      }
    } else if (!date) {
      // Default to today
      const today = new Date();
      where.createdAt = {
        gte: startOfDay(today),
        lte: endOfDay(today),
      };
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Search by employee name, employeeId, or orderNumber
    if (search) {
      const term = String(search).trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { employee: { name: { contains: term, mode: 'insensitive' } } },
        { employee: { employeeId: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.foodOrder.findMany({
      where,
      include: {
        employee: {
          include: { department: true },
        },
        items: {
          include: { foodItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: orders.map(formatOrderResponse),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/food/orders/:id/status (Food Owner / Admin updates status)
export const updateOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);

    const existingOrder = await prisma.foodOrder.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: true, department: true },
        },
        items: {
          include: { foodItem: true },
        },
      },
    });

    if (!existingOrder) {
      return next(createError('Food order not found', 404));
    }

    const { timestamps } = extractTimestampsFromNotes(existingOrder.notes);
    let updatedNotes = existingOrder.notes;
    let readyAt = timestamps.readyAt || null;
    let deliveredAt = timestamps.deliveredAt || null;
    const nowIso = new Date().toISOString();

    if (status === 'READY') {
      if (!readyAt) {
        readyAt = nowIso;
        updatedNotes = injectTimestampsToNotes(existingOrder.notes, { readyAt });
      }
    } else if (status === 'DELIVERED') {
      if (!readyAt) {
        readyAt = nowIso;
      }
      deliveredAt = nowIso;
      updatedNotes = injectTimestampsToNotes(existingOrder.notes, { readyAt, deliveredAt });
    }

    const updatedOrder = await prisma.foodOrder.update({
      where: { id },
      data: { status, notes: updatedNotes },
      include: {
        employee: {
          include: { department: true, user: true },
        },
        items: {
          include: { foodItem: true },
        },
      },
    });

    // Notify employee of status update
    const employeeUserId = existingOrder.employee?.user?.id || existingOrder.employee?.userId;
    if (employeeUserId) {
      let title = `Food Order #${updatedOrder.orderNumber} Update`;
      let message = `Your order status has been updated to ${status}.`;
      let type: 'INFO' | 'SUCCESS' | 'WARNING' = 'INFO';

      if (status === 'ACCEPTED') {
        title = `Order Accepted (#${updatedOrder.orderNumber})`;
        message = `Your food order has been accepted by the canteen.`;
        type = 'INFO';
      } else if (status === 'PREPARING') {
        title = `Order Preparing (#${updatedOrder.orderNumber})`;
        message = `Your food items are being prepared right now!`;
        type = 'INFO';
      } else if (status === 'READY') {
        title = `🎉 Order Ready (#${updatedOrder.orderNumber})!`;
        message = `Your food order is READY for pickup at the canteen / pantry!`;
        type = 'SUCCESS';
      } else if (status === 'DELIVERED') {
        title = `Order Delivered (#${updatedOrder.orderNumber})`;
        message = `Your food order has been delivered. Enjoy your meal!`;
        type = 'SUCCESS';
      } else if (status === 'CANCELLED') {
        title = `Order Cancelled (#${updatedOrder.orderNumber})`;
        message = `Your food order has been cancelled.`;
        type = 'WARNING';
      }

      await prisma.notification.create({
        data: {
          userId: employeeUserId,
          title,
          message,
          type,
          link: '/employee/food',
        },
      });

      // Automatically post structured status update message in chat
      const updaterUserId = req.user!.id;
      const foodOwner = await prisma.user.findFirst({ where: { role: 'FOOD_OWNER' } });
      const senderUserId = req.user?.role === 'ADMIN' && foodOwner ? foodOwner.id : updaterUserId;
      const statusUpdateMsg = formatOrderStatusUpdateMessage(updatedOrder, status, readyAt, deliveredAt);

      if (updaterUserId === employeeUserId && foodOwner) {
        // If employee updated/cancelled their own order, message the food owner
        await sendOrderChatMessage(employeeUserId, foodOwner.id, statusUpdateMsg);
      } else {
        // Food Owner or Admin updated order, message the employee
        await sendOrderChatMessage(senderUserId, employeeUserId, statusUpdateMsg);
      }
    }

    const formattedUpdatedOrder = formatOrderResponse(updatedOrder);

    // Broadcast Real-time event
    broadcastOrderEvent('ORDER_STATUS_CHANGED', formattedUpdatedOrder);

    res.json({
      success: true,
      data: formattedUpdatedOrder,
      message: `Order #${updatedOrder.orderNumber} marked as ${status}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// GET /api/food/orders/stats (Food Owner / Admin dashboard counters)
export const getOrderStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const todayOrders = await prisma.foodOrder.findMany({
      where: { createdAt: { gte: start, lte: end } },
    });

    const pending = todayOrders.filter((o) => o.status === 'PENDING').length;
    const accepted = todayOrders.filter((o) => o.status === 'ACCEPTED').length;
    const preparing = todayOrders.filter((o) => o.status === 'PREPARING').length;
    const ready = todayOrders.filter((o) => o.status === 'READY').length;
    const delivered = todayOrders.filter((o) => o.status === 'DELIVERED').length;
    const cancelled = todayOrders.filter((o) => o.status === 'CANCELLED').length;

    const todaySales = todayOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      success: true,
      data: {
        totalToday: todayOrders.length,
        pending,
        accepted,
        preparing,
        ready,
        delivered,
        cancelled,
        activeOrders: pending + accepted + preparing + ready,
        todaySales: Math.round(todaySales * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/food/orders/all (Admin all orders with rich filters)
export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      startDate,
      endDate,
      departmentId,
      employeeId,
      search,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startOfDay(new Date(String(startDate)));
      if (endDate) where.createdAt.lte = endOfDay(new Date(String(endDate)));
    }

    if (employeeId) {
      where.employeeId = String(employeeId);
    }

    if (departmentId) {
      where.employee = { departmentId: String(departmentId) };
    }

    if (search) {
      const term = String(search).trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { employee: { name: { contains: term, mode: 'insensitive' } } },
        { employee: { employeeId: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.foodOrder.count({ where }),
      prisma.foodOrder.findMany({
        where,
        include: {
          employee: {
            include: { department: true },
          },
          items: {
            include: { foodItem: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      success: true,
      data: orders.map(formatOrderResponse),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN MONTHLY REPORTS & EXPORTS
// ============================================================

// GET /api/food/reports/monthly (Data for admin report tab)
export const getMonthlyFoodReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const where: any = {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    };

    if (employeeId) where.employeeId = employeeId;
    if (departmentId) where.employee = { departmentId };

    const orders = await prisma.foodOrder.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        items: { include: { foodItem: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalSpend = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = orders.length;

    // Department Wise Summary
    const deptMap = new Map<string, { id: string; name: string; totalOrders: number; totalAmount: number }>();
    // Employee Wise Summary
    const empMap = new Map<string, { id: string; empId: string; name: string; department: string; totalOrders: number; totalAmount: number }>();
    // Daily Trend
    const dailyMap = new Map<string, { date: string; totalAmount: number; totalOrders: number }>();
    // Item Wise popular count
    const itemMap = new Map<string, { name: string; category: string; quantity: number; totalAmount: number }>();

    for (const order of orders) {
      // Dept aggregation
      const deptId = order.employee.departmentId || 'unassigned';
      const deptName = order.employee.department?.name || 'Unassigned';
      const currDept = deptMap.get(deptId) || { id: deptId, name: deptName, totalOrders: 0, totalAmount: 0 };
      currDept.totalOrders += 1;
      currDept.totalAmount += order.totalAmount;
      deptMap.set(deptId, currDept);

      // Employee aggregation
      const empIdKey = order.employeeId;
      const currEmp = empMap.get(empIdKey) || {
        id: order.employee.id,
        empId: order.employee.employeeId,
        name: order.employee.name,
        department: deptName,
        totalOrders: 0,
        totalAmount: 0,
      };
      currEmp.totalOrders += 1;
      currEmp.totalAmount += order.totalAmount;
      empMap.set(empIdKey, currEmp);

      // Daily trend
      const dayKey = format(order.createdAt, 'yyyy-MM-dd');
      const currDay = dailyMap.get(dayKey) || { date: dayKey, totalAmount: 0, totalOrders: 0 };
      currDay.totalAmount += order.totalAmount;
      currDay.totalOrders += 1;
      dailyMap.set(dayKey, currDay);

      // Items aggregation
      for (const item of order.items) {
        const itemName = item.itemName;
        const currItem = itemMap.get(itemName) || {
          name: itemName,
          category: item.foodItem?.category || 'General',
          quantity: 0,
          totalAmount: 0,
        };
        currItem.quantity += item.quantity;
        currItem.totalAmount += item.subtotal;
        itemMap.set(itemName, currItem);
      }
    }

    res.json({
      success: true,
      data: {
        year,
        month,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalOrders,
        uniqueEmployeesCount: empMap.size,
        avgOrderValue: totalOrders > 0 ? Math.round((totalSpend / totalOrders) * 100) / 100 : 0,
        departmentSummary: Array.from(deptMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        employeeSummary: Array.from(empMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        dailyTrend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        topItems: Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/food/reports/export/excel (Admin Excel Download)
export const exportMonthlyFoodExcel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const where: any = {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    };
    if (departmentId) where.employee = { departmentId };

    const orders = await prisma.foodOrder.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        items: { include: { foodItem: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkPulse Food Ordering System';
    workbook.created = new Date();

    // ----------------------------------------------------
    // Sheet 1: Employee Wise Expense Summary
    // ----------------------------------------------------
    const empSheet = workbook.addWorksheet('Employee Expenses');
    empSheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Department', key: 'dept', width: 22 },
      { header: 'Total Orders', key: 'ordersCount', width: 14 },
      { header: 'Total Food Expenses (Rs.)', key: 'totalAmount', width: 25 },
    ];

    // Style header row
    empSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    empSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    empSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const empMap = new Map<string, { empId: string; name: string; dept: string; count: number; total: number }>();
    for (const o of orders) {
      const e = empMap.get(o.employeeId) || {
        empId: o.employee.employeeId,
        name: o.employee.name,
        dept: o.employee.department?.name || 'Unassigned',
        count: 0,
        total: 0,
      };
      e.count += 1;
      e.total += o.totalAmount;
      empMap.set(o.employeeId, e);
    }

    let overallTotal = 0;
    Array.from(empMap.values())
      .sort((a, b) => b.total - a.total)
      .forEach((emp) => {
        overallTotal += emp.total;
        empSheet.addRow({
          empId: emp.empId,
          name: emp.name,
          dept: emp.dept,
          ordersCount: emp.count,
          totalAmount: Math.round(emp.total * 100) / 100,
        });
      });

    // Total Row
    const totalRow = empSheet.addRow({
      empId: 'TOTAL',
      name: 'All Employees Combined',
      dept: '-',
      ordersCount: orders.length,
      totalAmount: Math.round(overallTotal * 100) / 100,
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    // ----------------------------------------------------
    // Sheet 2: All Order Details
    // ----------------------------------------------------
    const orderSheet = workbook.addWorksheet('All Orders');
    orderSheet.columns = [
      { header: 'Order Number', key: 'orderNum', width: 22 },
      { header: 'Date & Time', key: 'dateTime', width: 20 },
      { header: 'Employee ID', key: 'empId', width: 14 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Break Time Slot', key: 'breakTime', width: 28 },
      { header: 'Items Ordered', key: 'itemsSummary', width: 40 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Total (Rs.)', key: 'total', width: 16 },
    ];

    orderSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    orderSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    orderSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    orders.forEach((o) => {
      const itemsText = o.items.map((i) => `${i.itemName} (x${i.quantity})`).join(', ');
      orderSheet.addRow({
        orderNum: o.orderNumber,
        dateTime: format(o.createdAt, 'dd/MM/yyyy hh:mm a'),
        empId: o.employee.employeeId,
        name: o.employee.name,
        dept: o.employee.department?.name || 'Unassigned',
        breakTime: o.breakTime,
        itemsSummary: itemsText,
        status: o.status,
        total: Math.round(o.totalAmount * 100) / 100,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Food_Expense_Report_${year}_${month}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

// GET /api/food/reports/export/pdf (Admin PDF Download)
export const exportMonthlyFoodPdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const where: any = {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    };
    if (departmentId) where.employee = { departmentId };

    const orders = await prisma.foodOrder.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy');
    const totalSpend = orders.reduce((s, o) => s + o.totalAmount, 0);

    // Group by Employee
    const empMap = new Map<string, { empId: string; name: string; dept: string; count: number; total: number }>();
    for (const o of orders) {
      const e = empMap.get(o.employeeId) || {
        empId: o.employee.employeeId,
        name: o.employee.name,
        dept: o.employee.department?.name || 'Unassigned',
        count: 0,
        total: 0,
      };
      e.count += 1;
      e.total += o.totalAmount;
      empMap.set(o.employeeId, e);
    }

    const empList = Array.from(empMap.values()).sort((a, b) => b.total - a.total);

    // Initialize jsPDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Document Title Banner
    doc.setFillColor(79, 70, 229); // Primary Indigo
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('WorkPulse - Food & Canteen Expense Report', 14, 13);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${monthName} | Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 21);

    // Metric Summary Boxes
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Overview', 14, 38);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);

    // Box 1: Total Spend
    doc.roundedRect(14, 42, 58, 20, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL FOOD EXPENSES', 18, 48);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`Rs. ${totalSpend.toLocaleString('en-IN')}`, 18, 56);

    // Box 2: Total Orders
    doc.roundedRect(76, 42, 58, 20, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL ORDERS PLACED', 80, 48);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${orders.length} Orders`, 80, 56);

    // Box 3: Active Employees
    doc.roundedRect(138, 42, 58, 20, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ACTIVE EMPLOYEES', 142, 48);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${empList.length} Employees`, 142, 56);

    // Employee Wise Table
    const tableBody = empList.map((emp) => [
      emp.empId,
      emp.name,
      emp.dept,
      emp.count.toString(),
      `Rs. ${Math.round(emp.total).toLocaleString('en-IN')}`,
    ]);

    // Add total row at bottom
    tableBody.push(['', 'TOTAL', '', orders.length.toString(), `Rs. ${Math.round(totalSpend).toLocaleString('en-IN')}`]);

    (doc as any).autoTable({
      startY: 68,
      head: [['Employee ID', 'Employee Name', 'Department', 'Orders', 'Total Expense']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      margin: { left: 14, right: 14 },
    });

    // Send PDF stream
    const pdfBytes = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Food_Expense_Report_${year}_${month}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    next(error);
  }
};
