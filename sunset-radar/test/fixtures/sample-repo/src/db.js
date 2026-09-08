import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getOrders(userId) {
  return supabase.from('orders').select('*').eq('user_id', userId);
}
