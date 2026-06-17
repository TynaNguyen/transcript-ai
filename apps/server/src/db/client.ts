import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { config } from '../config.js'

// Singleton — KHÔNG tạo client mới ở bất kỳ file nào khác
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
})
