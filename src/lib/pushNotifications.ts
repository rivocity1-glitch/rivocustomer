import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Safely lazy-load expo-notifications to prevent Expo Go / SDK 53+ module evaluation crashes
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');

  // Configure handler only if Notifications module successfully loads
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('[PushToken] expo-notifications could not be initialized natively (e.g., running in Expo Go).');
}

/**
 * Generates an Expo Push Token and updates the customer record in Supabase
 */
export async function saveCustomerPushToken(authUserId: string): Promise<string | null> {
  console.log('[PushToken] Starting registration for Auth User ID:', authUserId);

  if (!Notifications) {
    console.warn('[PushToken] Notifications module not available in this environment. Skipping.');
    return null;
  }

  // 1. Ensure code runs on a physical device
  if (!Device.isDevice) {
    console.warn('[PushToken] Must use a physical device for push notifications. Skipping.');
    return null;
  }

  try {
    // 2. Set Android Notification Channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22CC71',
      });
      console.log('[PushToken] Android Notification Channel "default" initialized.');
    }

    // 3. Permissions Check & Request
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    console.log('[PushToken] Initial Permission Status:', existingStatus);

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
      console.log('[PushToken] Updated Permission Status:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushToken] Push notification permission denied by user.');
      return null;
    }

    // 4. Resolve Project ID for EAS / Development Builds
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    console.log('[PushToken] Resolved EAS Project ID:', projectId);

    // 5. Generate Expo Push Token
    const pushTokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = pushTokenData?.data;
    console.log('[PushToken] Generated Expo Push Token:', token);

    if (!token) {
      console.error('[PushToken] Received empty token from Expo.');
      return null;
    }

    // 6. Update Customer Record in Supabase
    const { data: updateData, error: updateError } = await supabase
      .from('customers')
      .update({ expo_push_token: token })
      .eq('auth_user_id', authUserId)
      .select();

    if (updateError) {
      console.error('[PushToken] Supabase Update Error:', updateError);
      return null;
    }

    console.log('[PushToken] Supabase Update Result:', updateData);

    if (!updateData || updateData.length === 0) {
      console.warn(
        '[PushToken] No customer record matched auth_user_id:',
        authUserId,
        '. Token not persisted.'
      );
    } else {
      console.log('[PushToken] Token successfully saved to database!');
    }

    return token;
  } catch (err) {
    console.error('[PushToken] Exception occurred during registration:', err);
    return null;
  }
}