// app/api/amion-configurations/debug/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  console.log("=== SUPABASE DEBUG START ===")
  
  // Check environment variables
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      preview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'NOT SET',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      preview: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...' || 'NOT SET',
    },
  }
  
  console.log("Environment status:", envStatus)
  
  const results: any = {
    environment: envStatus,
    tests: {},
  }
  
  // Test 1: Create clients
  try {
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'invalid-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    // Test 2: Check table structure with service role
    console.log("Testing table structure...")
    const { data: columns, error: columnsError } = await supabaseService
      .from("amion_configurations")
      .select()
      .limit(0)
    
    if (columnsError) {
      results.tests.tableAccess = {
        success: false,
        error: columnsError.message,
        code: columnsError.code,
      }
    } else {
      results.tests.tableAccess = {
        success: true,
        message: "Table is accessible",
      }
    }
    
    // Test 3: Try a simple insert with service role
    console.log("Testing insert with service role...")
    const testId = `test-${Date.now()}`
    const { data: insertData, error: insertError } = await supabaseService
      .from("amion_configurations")
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        name: testId,
        description: 'Debug test',
        clinic_mappings: {},
        resident_mappings: {},
        merged_clinics: {},
        is_default: false,
      })
      .select()
      .single()
    
    if (insertError) {
      results.tests.serviceRoleInsert = {
        success: false,
        error: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
      }
      
      // If it's RLS error with service role, the key is not working
      if (insertError.code === '42501') {
        results.diagnosis = "🚨 SERVICE ROLE KEY IS NOT WORKING! The key might be incorrect or not properly loaded."
      }
    } else {
      results.tests.serviceRoleInsert = {
        success: true,
        insertedId: insertData.id,
      }
      
      // Clean up
      await supabaseService
        .from("amion_configurations")
        .delete()
        .eq("id", insertData.id)
    }
    
    // Test 4: Check auth functions
    console.log("Testing auth functions...")
    const { data: authTest, error: authError } = await supabaseService
      .rpc('auth.role')
      .single()
    
    results.tests.authRole = {
      success: !authError,
      role: authTest,
      error: authError?.message,
    }
    
  } catch (error) {
    console.error("Debug error:", error)
    results.criticalError = error instanceof Error ? error.message : "Unknown error"
  }
  
  // Diagnosis
  if (!envStatus.SUPABASE_SERVICE_ROLE_KEY.exists) {
    results.diagnosis = "🚨 SUPABASE_SERVICE_ROLE_KEY is not set in environment variables!"
    results.solution = "Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file"
  } else if (results.tests.serviceRoleInsert?.code === '42501') {
    results.diagnosis = "🚨 Service role key exists but is not bypassing RLS!"
    results.solution = "Your service role key might be incorrect. Get the correct one from Supabase Dashboard > Settings > API > Service role key"
  }
  
  console.log("=== SUPABASE DEBUG END ===")
  console.log("Results:", JSON.stringify(results, null, 2))
  
  return NextResponse.json(results)
}