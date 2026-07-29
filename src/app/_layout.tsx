import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "../global.css";
import { saveCustomerPushToken } from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  useEffect(() => {
    // 1. Refresh push token if user session already exists on startup
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        saveCustomerPushToken(user.id);
      }
    });

    // 2. Refresh push token when auth state changes (e.g. sign in)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        saveCustomerPushToken(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}