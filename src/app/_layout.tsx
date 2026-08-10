import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "../global.css";

import AnimatedSplash from "../../src/components/AnimatedSplash";

import { saveCustomerPushToken } from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Read current initial session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoaded(true);
      if (session?.user) {
        saveCustomerPushToken(session.user.id);
      }
    });

    // Listen for all auth state events and react
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsAuthLoaded(true);

      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        saveCustomerPushToken(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle immediate navigation based on authentication state changes
  useEffect(() => {
    if (!isAuthLoaded || showSplash) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";

   if (!session && !inAuthGroup) {
  router.replace("/login");
} else if (session && inAuthGroup) {
  router.replace("/");
}
  }, [session, isAuthLoaded, showSplash, segments]);

  if (showSplash) {
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}