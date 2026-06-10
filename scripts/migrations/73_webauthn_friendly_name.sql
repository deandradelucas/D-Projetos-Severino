-- Nome amigável do dispositivo na biometria (ex: "iPhone · Safari"), derivado do
-- User-Agent no momento do registro WebAuthn. Coluna opcional — credenciais antigas
-- ficam NULL e a UI mostra "Dispositivo".
alter table public.webauthn_credentials
  add column if not exists friendly_name text;
