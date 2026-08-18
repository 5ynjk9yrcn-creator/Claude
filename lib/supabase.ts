import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/* These two values are safe to ship inside the app: the publishable key only
   grants access that the database's row-level security rules allow. */
const SUPABASE_URL = "https://lotbohsxmttxxropegkt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bhhJGGeh6C3m1h8p5CJ0eA_kiAGhvJj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
