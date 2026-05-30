'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missingClient = (name) => new Proxy({}, {
  get() {
    throw new Error(`Missing Supabase environment variables for ${name}`);
  },
});

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : missingClient('supabase');

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : missingClient('supabaseAdmin');

module.exports = { supabase, supabaseAdmin };
