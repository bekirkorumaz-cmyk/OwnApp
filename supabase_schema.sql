create table if not exists public.period_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  duration integer not null check (duration between 2 and 8),
  selected_dates date[] not null,
  has_started boolean not null default true,
  flow_status text not null check (flow_status in ('hafif', 'orta', 'yoğun')),
  pain_level text not null check (pain_level in ('yok', 'hafif', 'orta', 'şiddetli')),
  created_at timestamptz not null default now()
);

alter table public.period_logs enable row level security;

create policy "Users can view their period logs"
on public.period_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their period logs"
on public.period_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their period logs"
on public.period_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their period logs"
on public.period_logs
for delete
to authenticated
using (auth.uid() = user_id);
