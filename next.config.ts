import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Do not set `experimental.optimisticRouting: false`: it would break `src/proxy.ts`. The client
  // then builds a route entry for `/?x` from the searchless one and lets the *redirected* search
  // win, so the saved query would take over the address bar on an ordinary sort click.
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
