async function diag() {
  const url = 'https://zesyderishnbjrpfbmqa.supabase.co/rest/v1/'
  console.log(`Checking ${url}...`)
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 10000)
    
    const res = await fetch(url, { 
      headers: { 'apikey': 'any' },
      signal: controller.signal
    })
    clearTimeout(id)
    console.log('Status:', res.status)
    console.log('Status Text:', res.statusText)
  } catch (err) {
    console.error('Diag Error:', err.message)
    if (err.name === 'AbortError') console.error('Request timed out')
  }
}

diag()
