import { supabase } from "../lib/supabase";

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  recipient_type: string | null;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
  metadata: Record<string, any> | null;
  deleted_at: string | null;
  action_url: string | null;
  priority: string | null;
  expires_at: string | null;
  created_by: string | null;
}

/**
 * Helper to resolve the logged-in customer's primary key (customers.id) from auth_user_id.
 * Flow: auth.uid() -> customers.auth_user_id -> customers.id
 */
export async function getResolvedCustomerId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: customerData, error } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error || !customerData?.id) {
      return null;
    }

    return customerData.id;
  } catch (err) {
    console.error("Failed resolving customer.id:", err);
    return null;
  }
}

/**
 * Convenience helper imported by Home screen to query unread count for current customer.
 */
export async function getUnreadCustomerNotificationCount(): Promise<number> {
  try {
    const customerId = await getResolvedCustomerId();
    if (!customerId) return 0;

    const { count, error } = await NotificationService.getUnreadCount(customerId, "customer");
    if (error) {
      console.error("Error fetching unread notification count:", error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error("Error in getUnreadCustomerNotificationCount:", err);
    return 0;
  }
}

export const NotificationService = {
  /**
   * Fetch all notifications for a customer.
   */
  async getNotifications(recipientId: string, recipientType: string = "customer") {
    return supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", recipientId)
      .eq("recipient_type", recipientType)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
  },

  /**
   * Fetch count of unread notifications for a customer.
   */
  async getUnreadCount(recipientId: string, recipientType: string = "customer") {
    return supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .eq("recipient_type", recipientType)
      .eq("is_read", false)
      .is("deleted_at", null);
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string) {
    return supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("recipient_type", "customer");
  },

  /**
   * Mark all unread notifications for a customer as read.
   */
  async markAllAsRead(recipientId: string, recipientType: string = "customer") {
    return supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", recipientId)
      .eq("recipient_type", recipientType)
      .eq("is_read", false);
  },

  /**
   * Soft-delete a notification entry.
   */
  async softDelete(id: string) {
    return supabase
      .from("notifications")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("recipient_type", "customer");
  },

  /**
   * Realtime notification subscription helper.
   * Listens ONLY on recipient_id = customers.id and checks recipient_type = "customer".
   */
  subscribe(
    recipientId: string,
    recipientType: string = "customer",
    callback?: (payload: any) => void
  ) {
    const handler = typeof recipientType === "function" ? recipientType : callback;
    const typeKey = typeof recipientType === "string" ? recipientType : "customer";

    const channel = supabase
      .channel(`notifications-customer-${recipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          if (
            handler &&
            (!payload.new || (payload.new as NotificationRecord).recipient_type === typeKey)
          ) {
            handler(payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};