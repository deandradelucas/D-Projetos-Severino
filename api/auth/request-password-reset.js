import { handle } from '@hono/node-server/vercel'
import app from '../../server/app.mjs'

export default handle(app)
