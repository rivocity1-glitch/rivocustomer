import { supabase } from '../lib/supabase';

export interface CustomerNotification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string;
  recipient_type: 'customer';
  reference_id: string | null;
  metadata: Record<string, any> | null;
}

/**
 * Fetch notifications for the currently logged-in customer.
 */
export async function getCustomerNotifications(): Promise<CustomerNotification[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_type', 'customer')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NotificationService] Error fetching customer notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark a single notification as read for the logged-in customer.
 */
export async function markCustomerNotificationAsRead(id: string): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('recipient_id', user.id);

  if (error) {
    console.error('[NotificationService] Failed to mark notification as read:', error);
    return false;
  }

  return true;
}

/**
 * Fetch total count of unread notifications for badge counts.
 */
export async function getUnreadCustomerNotificationCount(): Promise<number> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_type', 'customer')
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('[NotificationService] Error counting unread notifications:', error);
    return 0;
  }

  return count || 0;
}