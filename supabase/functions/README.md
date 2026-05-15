`delete-account` fonksiyonunu deploy etmek için:

1. Supabase CLI ile giriş yapın.
2. Proje dizininde şu komutu çalıştırın:
   `supabase functions deploy delete-account`
3. Function secret olarak service role key ekleyin:
   `supabase secrets set SERVICE_ROLE_KEY=...`

Fonksiyonun çalışması için Supabase tarafında şu environment değişkenleri bulunmalıdır:
- `SUPABASE_URL`
- `SERVICE_ROLE_KEY`
