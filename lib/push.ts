import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

/* Register this phone for push notifications and store the token server-side.
   In Expo Go this quietly does nothing (Apple push needs a real build) —
   the TestFlight build in Phase 6 makes it light up with no code changes. */
export async function registerForPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
  } catch {
    // Expected inside Expo Go; harmless anywhere else.
  }
}
