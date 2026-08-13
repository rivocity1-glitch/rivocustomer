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
  const [isCustomerVerified, setIsCustomerVerified] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  // ---------------------------------------------------------
  // AUTH + CUSTOMER SESSION
  // ---------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const validateCustomerSession = async (
      currentSession: any
    ) => {
      if (!currentSession?.user) {
        if (!mounted) return;

        setSession(null);
        setIsCustomerVerified(false);
        setIsAuthLoaded(true);
        return;
      }

      try {
        /*
         * A Supabase Auth session alone is NOT enough.
         *
         * The user must have an existing customers row
         * linked through customers.auth_user_id.
         */
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

          await supabase.auth.signOut();

          if (!mounted) return;

          setSession(null);
          setIsCustomerVerified(false);
          setIsAuthLoaded(true);
          return;
        }

        /*
         * Auth user exists but is not registered as a
         * Rivo customer.
         */
        if (!customer) {
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

        // Only save push token for verified customers.
        saveCustomerPushToken(currentSession.user.id);
      } catch (error) {
        console.error(
          "Customer session validation failed:",
          error
        );

        await supabase.auth.signOut();

        if (!mounted) return;

        setSession(null);
        setIsCustomerVerified(false);
        setIsAuthLoaded(true);
      }
    };

    // Initial session check.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        validateCustomerSession(session);
      });

    // Listen for authentication changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        /*
         * Do not blindly trust SIGNED_IN.
         *
         * SIGNED_IN only proves Supabase Auth succeeded.
         * validateCustomerSession() verifies that the Auth
         * user is actually a Rivo customer.
         */
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

  // ---------------------------------------------------------
  // ROUTING
  // ---------------------------------------------------------

  useEffect(() => {
    if (!isAuthLoaded || showSplash) {
      return;
    }

    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "register";

    /*
     * No valid customer session:
     * only login/register are allowed.
     */
    if (!session || !isCustomerVerified) {
      if (!inAuthGroup) {
        router.replace("/login");
      }

      return;
    }

    /*
     * Valid Rivo customer:
     * don't allow customer to remain on login/register.
     */
    if (session && isCustomerVerified && inAuthGroup) {
      router.replace("/");
    }
  }, [
    session,
    isCustomerVerified,
    isAuthLoaded,
    showSplash,
    segments,
  ]);

  // ---------------------------------------------------------
  // SPLASH
  // ---------------------------------------------------------

  if (showSplash) {
    return (
      <AnimatedSplash
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </>
  );
}
