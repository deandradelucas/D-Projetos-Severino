import '../server/lib/load-env.mjs'
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL)
console.log('Starts with quote:', process.env.VITE_SUPABASE_URL.startsWith('"'))
