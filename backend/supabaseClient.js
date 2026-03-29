const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-supabase-key';
const hasSupabaseConfig =
  SUPABASE_URL !== 'https://your-project.supabase.co' && SUPABASE_KEY !== 'your-supabase-key';

if (!hasSupabaseConfig) {
  console.warn('Supabase is using placeholder credentials. Replace SUPABASE_URL and SUPABASE_KEY before calling the API.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = {
  supabase,
  hasSupabaseConfig
};
