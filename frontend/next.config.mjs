import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

const chatwootUpstream =
  process.env.CHATWOOT_UPSTREAM || 'http://127.0.0.1:3000';
const gatewayUpstream =
  process.env.GATEWAY_UPSTREAM || 'http://127.0.0.1:8787';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/', destination: '/login', permanent: false },
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/_cw/:path*',
        destination: `${chatwootUpstream}/:path*`,
      },
      {
        source: '/_gw/:path*',
        destination: `${gatewayUpstream}/:path*`,
      },
      {
        source: '/proxy/api/:path*',
        destination: `${gatewayUpstream}/api/:path*`,
      },
      // Mobile app customer portal — proxy to gateway (Nginx regex doesn't catch this)
      {
        source: '/api/customer/:path*',
        destination: `${gatewayUpstream}/api/customer/:path*`,
      },
      {
        source: '/api/recordings/:path*',
        destination: `${gatewayUpstream}/api/recordings/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
