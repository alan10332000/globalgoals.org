const retry = require('p-retry')
const Prismic = require('prismic-javascript')
const { getCode } = require('../locale')

module.exports = async function prismicApi (ctx, next) {
  ctx.state.isEditor = Boolean(ctx.cookies.get(Prismic.previewCookie))

  /**
   * Expose the Prismic api on the context object
   */

  const init = Date.now()
  const api = ctx.prismic = await retry(getApi, {
    retries: 5,
    onFailedAttempt (err) {
      if (err.retriesLeft) {
        ctx.track.exception(err.message || err, false).send()
      }
    }
  })
  ctx.track.timing('Init', 'api', Date.now() - init, 'Prismic').send()

  /**
   * Capture and track all queries to Prismic
   */

  const _query = api.query
  api.query = async function query (predicates, opts = {}, callback) {
    const start = Date.now()

    if (typeof opts === 'function') {
      callback = opts
      opts = {}
    }

    opts.lang = opts.lang || getCode(ctx.state.lang)

    try {
      const response = await _query.call(this, predicates, opts, callback)

      ctx.track.timing(
        'Query',
        Array.isArray(predicates) ? predicates.join(',') : predicates,
        Date.now() - start,
        'Prismic'
      ).send()

      return response
    } catch (err) {
      await ctx.track.exception(err.message).send()
      throw err
    }
  }

  return next()

  function getApi () {
    return Prismic.api(process.env.PRISMIC_API, { req: ctx.req })
  }
}
