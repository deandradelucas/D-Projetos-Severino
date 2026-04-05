import { handle } from 'hono/vercel'
import app from '../server/app.mjs'

export default handle(app)
