'use strict';

const { createClient } = require('@supabase/supabase-js');

let websocketConstructor = undefined;
try {
  // Node.js < 22 needs the 'ws' package for WebSocket support
  websocketConstructor = require('ws');
} catch (e) {
  // Native WebSocket should be available in Node.js 22+
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missingClient = (name) => new Proxy({}, {
  get() {
    throw new Error(`Missing Supabase environment variables for ${name}`);
  },
});

const commonOptions = {
  auth: { persistSession: false },
  ...(websocketConstructor ? { transport: { websocket: websocketConstructor } } : {}),
};

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, commonOptions)
  : missingClient('supabase');

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, commonOptions)
  : missingClient('supabaseAdmin');

module.exports = { supabase, supabaseAdmin };
