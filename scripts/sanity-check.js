"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var admin = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
var _a = await admin.from('amion_configurations').select('*').limit(1), data = _a.data, error = _a.error;
console.log({ data: data, error: error });
