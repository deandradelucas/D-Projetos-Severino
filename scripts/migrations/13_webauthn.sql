-- WebAuthn (biometria / passkey no navegador): desafios temporários e credenciais por usuário.
-- Rodar no SQL Editor do Supabase após migrations anteriores.

create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('registration', 'authentication')),
  usuario_id uuid references public.usuarios (id) on delete cascade,
  email text,
  challenge text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists webauthn_challenges_expires_at on public.webauthn_challenges (expires_at);

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint webauthn_credentials_credential_id_key unique (credential_id)
);

create index if not exists webauthn_credentials_usuario_id on public.webauthn_credentials (usuario_id);
