import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import "../global.css";

import AnimatedSplash from "../../src/components/AnimatedSplash";
import FloatingFeedback from "../../src/components/FloatingFeedback";
import { saveCustomerPushToken } from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isCustomerVerified, setIsCustomerVerified] = useState(false);

  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;

    const validateCustomerSession = async (
      currentSession: any,
      retryCount = 0
    ) => {
      if (!currentSession?.user) {
        if (!mounted) return;
        setSession(null);
        setIsCustomerVerified(false);
        setIsAuthLoaded(true);
        return;
      }

      try {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", currentSession.user.id)
          .maybeSingle();

        if (customerError) {
          console.error("Customer session validation error:", customerError);
          if (retryCount < 10) {
            setTimeout(() => {
              if (mounted) validateCustomerSession(currentSession, retryCount + 1);
            }, 500);
            return;
          }

          await supabase.auth.signOut();
          if (!mounted) return;
          setSession(null);
          setIsCustomerVerified(false);
          setIsAuthLoaded(true);
          return;
        }

        if (!customer) {
          if (retryCount < 10) {
            setTimeout(() => {
              if (mounted) validateCustomerSession(currentSession, retryCount + 1);
            }, 500);
            return;
          }

          console.warn("Authenticated user has no Rivo customer record.");
          await supabase.auth.signOut();
          if (!mounted) return;
          setSession(null);
          setIsCustomerVerified(false);
          setIsAuthLoaded(true);
          return;
        }

        if (!mounted) return;
        setSession(currentSession);
        setIsCustomerVerified(true);
        setIsAuthLoaded(true);
        saveCustomerPushToken(currentSession.user.id);
      } catch (error) {
        console.error("Customer session validation failed:", error);

        if (retryCount < 10) {
          setTimeout(() => {
            if (mounted) validateCustomerSession(currentSession, retryCount + 1);
          }, 500);
          return;
        }

        await supabase.auth.signOut();
        if (!mounted) return;
        setSession(null);
        setIsCustomerVerified(false);
        setIsAuthLoaded(true);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      validateCustomerSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION"
      ) {
        validateCustomerSession(currentSession);
      }

      if (event === "SIGNED_OUT") {
        if (!mounted) return;
        setSession(null);
        setIsCustomerVerified(false);
        setIsAuthLoaded(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoaded || showSplash) return;

    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "register";

    if (!session || !isCustomerVerified) {
      if (!inAuthGroup) router.replace("/login");
      return;
    }

    if (session && isCustomerVerified && inAuthGroup) {
      router.replace("/");
    }
  }, [session, isCustomerVerified, isAuthLoaded, showSplash, segments]);

  if (showSplash) {
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }

  const showFloatingFeedback =
    Boolean(session && isCustomerVerified) &&
    segments[0] !== "login" &&
    segments[0] !== "register" &&
    segments[0] !== "support-lite";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false }} />

      {showFloatingFeedback && (
        <View
          pointerEvents="box-none"
          style={[
            styles.floatingLayer,
            { paddingBottom: Math.max(insets.bottom, 12) + 96 },
          ]}
        >
          <FloatingFeedback />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  floatingLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 16,
    zIndex: 100,
  },
});