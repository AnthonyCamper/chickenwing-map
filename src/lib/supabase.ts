import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nzovofzjqjvxbzvelhyd.supabase.co/'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b3ZvZnpqcWp2eGJ6dmVsaHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE2NTMsImV4cCI6MjAzNjIxNzY1M30.LHuDVB1SFp2BeC3UT7JpxlhW_8v-kf32u6jxSFNWSdg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)