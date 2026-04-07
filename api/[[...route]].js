import { handle } from 'hono/vercel'
import app from '../server/app.mjs'

export const runtime = 'nodejs'
export const maxDuration = 60

export default handle(app)
