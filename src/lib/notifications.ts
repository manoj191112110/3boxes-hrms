import prisma from '@/lib/prisma';

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'login' | 'logout' | 'workflow';
type NotificationCategory = 'system' | 'auth' | 'leave' | 'payroll' | 'recruitment' | 'performance' | 'workflow' | 'alert';

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { tenantId, userId, title, message, type = 'info', category = 'system', link } = params;

  try {
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        title,
        message,
        type,
        category,
        link,
        isRead: false,
        isEmailSent: false,
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}
