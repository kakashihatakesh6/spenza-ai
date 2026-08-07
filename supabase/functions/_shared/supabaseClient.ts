// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export const getSupabaseClient = (req?: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  
  if (req) {
    const authHeader = req.headers.get('Authorization');
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const getServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase Service Role environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
