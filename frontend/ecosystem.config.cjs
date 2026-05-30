/** PM2 — use Next.js standalone output (required when output: 'standalone' in next.config). */
module.exports = {
  apps: [
    {
      name: 'blinkone-frontend',
      cwd: '/opt/blinkone/frontend',
      script: '.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOSTNAME: '0.0.0.0',
        CALL_DEBUG_LOG: '/tmp/blinkone-call-debug.ndjson',
      },
    },
  ],
};
