import { supabase } from "../lib/supabase";

export interface CreateNotificationInput {
  userType: "customer" | "vendor" | "rider" | "admin";
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(input: CreateNotificationInput) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      recipient_type: input.userType,
      recipient_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      reference_id: input.referenceId ?? null,
      metadata: input.metadata ?? {},
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}