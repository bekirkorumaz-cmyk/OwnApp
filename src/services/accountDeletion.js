import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabaseConfig';
import { requireSupabase } from './supabaseClient';

export const deleteCloudAccount = async () => {
  const client = requireSupabase();
  const {
    data: { session: currentSession },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!currentSession?.refresh_token) {
    throw new Error('Hesap silmek için aktif oturum bulunamadı.');
  }

  const {
    data: refreshedData,
    error: refreshError,
  } = await client.auth.refreshSession({
    refresh_token: currentSession.refresh_token,
  });

  if (refreshError) {
    throw refreshError;
  }

  const accessToken = refreshedData.session?.access_token;
  if (!accessToken) {
    throw new Error('Hesap silmek için guncel oturum alinmadi.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accessToken }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      payload?.message ||
      `Hesap silme servisi basarisiz oldu (${response.status}).`
    );
  }

  if (!payload?.success) {
    throw new Error(payload?.error || 'Hesap silme servisi basarisiz oldu.');
  }

  return payload;
};
