// app/api/amion-configurations/debug-user/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userEmail } = body
    
    console.log("=== DEBUG USER SAVE ===")
    console.log("Provided userId:", userId)
    console.log("Provided userEmail:", userEmail)
    
    // Create service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    const results: any = {
      providedData: { userId, userEmail },
      tests: {},
    }
    
    // Test 1: Check if user exists in auth.users
    console.log("Checking if user exists in auth.users...")
    try {
      const { data: authUser, error: authError } = await supabaseAdmin
        .auth.admin.getUserById(userId)
      
      if (authError) {
        results.tests.authUserLookup = {
          success: false,
          error: authError.message,
        }
      } else {
        results.tests.authUserLookup = {
          success: true,
          found: !!authUser.user,
          email: authUser.user?.email,
          id: authUser.user?.id,
          created_at: authUser.user?.created_at,
        }
      }
    } catch (e) {
      results.tests.authUserLookup = {
        success: false,
        error: "Failed to query auth.users",
        details: e instanceof Error ? e.message : "Unknown error",
      }
    }
    
    // Test 2: Try a raw SQL query to check users
    console.log("Checking users table directly...")
    const { data: userTableCheck, error: userTableError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()
    
    if (userTableError) {
      results.tests.usersTableCheck = {
        success: false,
        error: userTableError.message,
        code: userTableError.code,
      }
    } else {
      results.tests.usersTableCheck = {
        success: true,
        found: !!userTableCheck,
        data: userTableCheck,
      }
    }
    
    // Test 3: Check existing configurations for this user
    console.log("Checking existing configurations...")
    const { data: existingConfigs, error: configError } = await supabaseAdmin
      .from("amion_configurations")
      .select("id, name, created_at")
      .eq("user_id", userId)
    
    results.tests.existingConfigurations = {
      success: !configError,
      count: existingConfigs?.length || 0,
      error: configError?.message,
    }
    
    // Test 4: Try to insert a test configuration
    console.log("Attempting to insert test configuration...")
    const testConfig = {
      user_id: userId,
      name: `Debug Test ${new Date().toISOString()}`,
      description: "Created by debug endpoint",
      clinic_mappings: {},
      resident_mappings: {},
      merged_clinics: {},
      is_default: false,
    }
    
    const { data: insertResult, error: insertError } = await supabaseAdmin
      .from("amion_configurations")
      .insert(testConfig)
      .select()
      .single()
    
    if (insertError) {
      results.tests.testInsert = {
        success: false,
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      }
      
      // If foreign key error, let's check what the constraint expects
      if (insertError.code === '23503') {
        // Get more info about the foreign key
        const { data: fkInfo } = await supabaseAdmin.rpc('get_table_info', {
          table_name: 'amion_configurations'
        }).single()
        
        results.tests.foreignKeyInfo = fkInfo
      }
    } else {
      results.tests.testInsert = {
        success: true,
        insertedId: insertResult.id,
        message: "Successfully inserted test configuration!",
      }
      
      // Clean up
      await supabaseAdmin
        .from("amion_configurations")
        .delete()
        .eq("id", insertResult.id)
    }
    
    // Test 5: Check the actual auth.users table structure
    console.log("Checking auth schema...")
    const { data: authSchema } = await supabaseAdmin.rpc('check_auth_schema')
    results.tests.authSchema = authSchema
    
    // Diagnosis
    if (results.tests.authUserLookup?.found && results.tests.testInsert?.success) {
      results.diagnosis = "✅ Everything is working! The user exists and configurations can be saved."
    } else if (results.tests.authUserLookup?.found && !results.tests.testInsert?.success) {
      results.diagnosis = "⚠️ User exists in auth.users but insert still failed. Check the foreign key constraint."
    } else if (!results.tests.authUserLookup?.found) {
      results.diagnosis = "❌ User ID does not exist in auth.users table!"
    }
    
    console.log("=== DEBUG RESULTS ===")
    console.log(JSON.stringify(results, null, 2))
    
    return NextResponse.json(results)
    
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({
      error: "Debug failed",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}

// Add this RPC function to your Supabase SQL editor to get more info:
/*
CREATE OR REPLACE FUNCTION get_table_info(table_name text)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'columns', (
            SELECT json_agg(json_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable
            ))
            FROM information_schema.columns
            WHERE table_name = $1
        ),
        'foreign_keys', (
            SELECT json_agg(json_build_object(
                'constraint_name', tc.constraint_name,
                'column_name', kcu.column_name,
                'foreign_table', ccu.table_name,
                'foreign_column', ccu.column_name
            ))
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = $1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_auth_schema()
RETURNS json AS $$
BEGIN
    RETURN json_build_object(
        'auth_users_exists', EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'users'
        ),
        'public_users_exists', EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
        )
    );
END;
$$ LANGUAGE plpgsql;
*/
