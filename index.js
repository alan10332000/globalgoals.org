const Koa = require('koa')
const body = require('koa-body')
const serve = require('koa-static')
const helmet = require('koa-helmet')
const noTrailingSlash = require('koa-no-trailing-slash')
const app = require('./lib/app')
const purge = require('./lib/purge')
const router = require('./lib/router')
const api = require('./lib/middleware/api')
const cache = require('./lib/middleware/cache')
const assets = require('./lib/middleware/assets')
const render = require('./lib/middleware/render')
const prismic = require('./lib/middleware/prismic')
const redirects = require('./lib/middleware/redirects')
const analytics = require('./lib/middleware/analytics')
const imageproxy = require('./lib/middleware/cloudinary-proxy')

const server = new Koa()

/**
 * Compile and serve assets on demand during development
 */

if (process.env.NODE_ENV === 'development') {
  // Serve live client resources
  server.use(require('./lib/middleware/watchify'))
  server.use(require('./lib/middleware/postcss'))

  // Serve components assets from disk
  server.use(serve('lib'))
}

/**
 * Take extra care to clean up em' headers in production
 */

if (process.env.NODE_ENV !== 'development') {
  server.use(helmet())
}

/**
 * Prevent indexing everything but production
 */

server.use(require('./lib/middleware/robots'))

/**
 * Proxy cloudinary on-demand-transform API
 */

server.use(imageproxy)

/**
 * Capture special routes before any other middleware
 */

server.use(api)
server.use(redirects)

/**
 * Remove trailing slashes before continuing
 */

server.use(noTrailingSlash())

/**
 * Serve static files
 */

server.use(assets)
if (process.env.NODE_ENV !== 'development') {
  server.use(serve('public', { maxage: 1000 * 60 * 60 * 24 * 365 }))
}

/**
 * Add on Universal Analytics for server process tracking
 */

server.use(analytics(process.env.GOOGLE_ANALYTICS_ID))

/**
 * Set up request cache mechanism
 */

server.use(cache)

/**
 * Parse request body
 */

server.use(body())

/**
 * Handle rendering response
 */

server.use(render(app))

/**
 * Hook up the Prismic api
 */

server.use(prismic)

/**
 * Hook up em' routes
 */

server.use(router)

/**
 * Lift off
 */

if (process.env.NOW && process.env.NODE_ENV !== 'development') {
  purge(['/service-worker.js'], (err) => {
    if (err) return console.error(err)
    server.listen(process.env.PORT, () => {
      console.info(`🚀  Server listening at localhost:${process.env.PORT}`)
    })
  })
} else {
  server.listen(process.env.PORT, () => {
    console.info(`🚀  Server listening at localhost:${process.env.PORT}`)
  })
}
