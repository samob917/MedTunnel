import { createClient } from "@supabase/supabase-js"

const supabaseUrl = 'https://gpgtmtchmkimcdzzhsnv.supabase.co'!
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZ3RtdGNobWtpbWNkenpoc252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NzkwODEsImV4cCI6MjA2ODM1NTA4MX0.1QsVc6Vl5zgbdsLQvUbT_Hosc6GwHoJaBWr-ywNou_c'!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          subscription_tier: "free" | "pro" | "enterprise"
          usage_count: number
          last_reset: string
        }
        Insert: {
          id: string
          email: string
          subscription_tier?: "free" | "pro" | "enterprise"
          usage_count?: number
        }
        Update: {
          subscription_tier?: "free" | "pro" | "enterprise"
          usage_count?: number
          last_reset?: string
        }
      }
      conversions: {
        Row: {
          id: string
          user_id: string | null
          tunnel_id: string
          file_name: string
          created_at: string
          status: "processing" | "completed" | "failed"
        }
        Insert: {
          user_id?: string | null
          tunnel_id: string
          file_name: string
          status?: "processing" | "completed" | "failed"
        }
        Update: {
          status?: "processing" | "completed" | "failed"
        }
      }
    }
  }
}
