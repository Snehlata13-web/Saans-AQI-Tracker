import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Runs the /api/*.js Vercel functions locally during `npm run dev`
function localApi() {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()
        const u = new URL(req.url, 'http://localhost')
        const file = path.resolve('api', u.pathname.replace('/api/', '') + '.js')
        try {
          const mod = await import(pathToFileURL(file).href + '?t=' + Date.now())
          let raw = ''
          for await (const chunk of req) raw += chunk
          req.query = Object.fromEntries(u.searchParams)
          req.body = raw ? JSON.parse(raw) : undefined
          res.status = (c) => { res.statusCode = c; return res }
          res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)) }
          await mod.default(req, res)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e.message || e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), localApi()],
    build: {
      chunkSizeWarningLimit: 2000,
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/three|@react-three|three-stdlib|maath|troika|meshline/.test(id)) return 'three'
            if (/react-dom|scheduler|\/react\//.test(id)) return 'react'
          },
        },
      },
    },
  }
})
