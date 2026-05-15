import Constants from 'expo-constants';

const expoConfigExtra = Constants.expoConfig?.extra || Constants.manifest2?.extra || {};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || expoConfigExtra.supabaseUrl || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoConfigExtra.supabaseAnonKey || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
