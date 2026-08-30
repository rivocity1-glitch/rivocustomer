import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
        const {
          data: customer,
          error: customerError,
        } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", currentSession.user.id)
          .maybeSingle();

        if (customerError) {
          console.error(
            "Customer session validation error:",
            customerError
          );

          if (retryCount < 10) {
            setTimeout(() => {
              if (mounted) {
                validateCustomerSession(
                  currentSession,
                  retryCount + 1
                );
              }
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
              if (mounted) {
                validateCustomerSession(
                  currentSession,
                  retryCount + 1
                );
              }
            }, 500);

            return;
          }

          console.warn(
            "Authenticated user has no Rivo customer record."
          );

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
        console.error(
          "Customer session validation failed:",
          error
        );

        if (retryCount < 10) {
          setTimeout(() => {
            if (mounted) {
              validateCustomerSession(
                currentSession,
                retryCount + 1
              );
            }
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

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        validateCustomerSession(session);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
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
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoaded || showSplash) {
      return;
    }

    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "register";

    if (!session || !isCustomerVerified) {
      if (!inAuthGroup) {
        router.replace("/login");
      }

      return;
    }

    if (
      session &&
      isCustomerVerified &&
      inAuthGroup
    ) {
      router.replace("/");
    }
  }, [
    session,
    isCustomerVerified,
    isAuthLoaded,
    showSplash,
    segments,
  ]);

  if (showSplash) {
    return (
      <AnimatedSplash
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  const showFloatingFeedback =
    session &&
    isCustomerVerified &&
    segments[0] !== "login" &&
    segments[0] !== "register" &&
    segments[0] !== "support" &&
    segments[0] !== "feedback" &&
    segments[0] !== "report-problem";

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      {showFloatingFeedback && (
        <FloatingFeedback />
      )}
    </>
  );
}
