export function clientIpFromHono(c) {
  const xf = c.req.header('x-forwarded-for')
  if (xf) return String(xf).split(',')[0].trim().slice(0, 80)
  const alt = c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || ''
  return String(alt).slice(0, 80)
}
