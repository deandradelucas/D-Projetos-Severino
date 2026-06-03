-- Foto de perfil do usuário. Guarda um data URL (base64) JPEG redimensionado
-- no cliente para ~256px (≈15-30KB). Aditiva e segura: NULL = sem foto (mostra iniciais).
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS avatar_url text NULL;
