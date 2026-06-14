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

// Use ws package for Node < 22 (no native WebSocket)
let wsTransport = undefined;
try {
  const ws = require('ws');
  if (ws && typeof ws === 'function') {
    wsTransport = ws;
  }
} catch (e) {
  // ws not available, rely on native WebSocket (Node 22+)
}

const commonOptions = {
  auth: { persistSession: false },
};

// Only add transport if ws was successfully loaded
if (wsTransport) {
  commonOptions.transport = wsTransport;
}

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, commonOptions)
  : missingClient('supabase');

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, commonOptions)
  : missingClient('supabaseAdmin');

module.exports = { supabase, supabaseAdmin };
