/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  experimental: {
    turbo: {
      rules: {
        '*.ts': ['typescript'],
      },
    },
  },
};

module.exports = nextConfig;
