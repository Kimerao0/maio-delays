import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The audience is Italian and so are the kick-off times in the source CSVs; pin the zone so a
    // calendar-day comparison means the same thing in tests, locally and on Vercel (TZ is set there
    // to match). Left to the host, `new Date('2026-07-01')` lands in June west of UTC.
    env: { TZ: 'Europe/Rome' },
  },
})
