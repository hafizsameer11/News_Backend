import prisma from "@/config/prisma";
import { ROLE } from "@/types/enums";

export class ChatService {
  /**
   * Get all conversations for a user (admin or regular user)
   */
  async getConversations(userId: string, userRole: ROLE) {
    if (userRole === ROLE.ADMIN || userRole === ROLE.SUPER_ADMIN) {
      // Admin sees all conversations with all users
      const conversations = await prisma.chat.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Group by conversation partner
      const conversationMap = new Map<string, any>();

      conversations.forEach((chat) => {
        const partnerId = chat.senderId === userId ? chat.receiverId : chat.senderId;
        const partner = chat.senderId === userId ? chat.receiver : chat.sender;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            partner,
            lastMessage: chat,
            unreadCount: 0,
            messages: [],
          });
        }

        const conv = conversationMap.get(partnerId);
        if (chat.receiverId === userId && !chat.isRead) {
          conv.unreadCount++;
        }
        if (chat.createdAt > conv.lastMessage.createdAt) {
          conv.lastMessage = chat;
        }
        conv.messages.push(chat);
      });

      return Array.from(conversationMap.values()).map((conv) => ({
        partner: conv.partner,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount,
      }));
    } else {
      // Regular users see conversations with admins only
      const conversations = await prisma.chat.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Filter to only show admins as conversation partners
      const adminConversations = conversations.filter((chat) => {
        const partner = chat.senderId === userId ? chat.receiver : chat.sender;
        return partner.role === ROLE.ADMIN || partner.role === ROLE.SUPER_ADMIN;
      });

      // Group by conversation partner
      const conversationMap = new Map<string, any>();

      adminConversations.forEach((chat) => {
        const partnerId = chat.senderId === userId ? chat.receiverId : chat.senderId;
        const partner = chat.senderId === userId ? chat.receiver : chat.sender;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            partner,
            lastMessage: chat,
            unreadCount: 0,
            messages: [],
          });
        }

        const conv = conversationMap.get(partnerId);
        if (chat.receiverId === userId && !chat.isRead) {
          conv.unreadCount++;
        }
        if (chat.createdAt > conv.lastMessage.createdAt) {
          conv.lastMessage = chat;
        }
        conv.messages.push(chat);
      });

      return Array.from(conversationMap.values()).map((conv) => ({
        partner: conv.partner,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount,
      }));
    }
  }

  /**
   * Get messages between two users
   */
  async getMessages(userId: string, partnerId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chat.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.chat.count({
        where: {
          OR: [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId },
          ],
        },
      }),
    ]);

    // Mark messages as read if current user is receiver
    await prisma.chat.updateMany({
      where: {
        receiverId: userId,
        senderId: partnerId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send a message
   */
  async sendMessage(senderId: string, receiverId: string, message: string) {
    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new Error("Receiver not found");
    }

    // Verify sender exists
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      throw new Error("Sender not found");
    }

    const chat = await prisma.chat.create({
      data: {
        senderId,
        receiverId,
        message,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return chat;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(userId: string, partnerId: string) {
    return await prisma.chat.updateMany({
      where: {
        receiverId: userId,
        senderId: partnerId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string) {
    return await prisma.chat.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }

  /**
   * Get available admins for users to chat with
   */
  async getAvailableAdmins() {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: [ROLE.ADMIN, ROLE.SUPER_ADMIN],
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    return admins;
  }

  /**
   * Get all users that admin can chat with (for admin dashboard)
   */
  async getChatUsers(adminId: string) {
    // Get all users (excluding admins and super admins)
    const allUsers = await prisma.user.findMany({
      where: {
        role: {
          notIn: [ROLE.ADMIN, ROLE.SUPER_ADMIN],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all chats with these users
    const userIds = allUsers.map((u) => u.id);
    const chats = await prisma.chat.findMany({
      where: {
        OR: [
          { senderId: adminId, receiverId: { in: userIds } },
          { receiverId: adminId, senderId: { in: userIds } },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
          },
        },
        receiver: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Create a map of user data with chat info
    const userMap = new Map<string, any>();

    // Initialize all users
    allUsers.forEach((user) => {
      userMap.set(user.id, {
        ...user,
        unreadCount: 0,
        lastMessageAt: user.createdAt,
      });
    });

    // Update with chat information
    chats.forEach((chat) => {
      const partnerId = chat.senderId === adminId ? chat.receiverId : chat.senderId;
      if (userMap.has(partnerId)) {
        const userData = userMap.get(partnerId);
        // Update unread count
        if (chat.senderId === partnerId && chat.receiverId === adminId && !chat.isRead) {
          userData.unreadCount++;
        }
        // Update last message time if this is more recent
        if (chat.createdAt > new Date(userData.lastMessageAt)) {
          userData.lastMessageAt = chat.createdAt;
        }
      }
    });

    // Sort by last message time (most recent first), then by unread count
    return Array.from(userMap.values()).sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }
}
