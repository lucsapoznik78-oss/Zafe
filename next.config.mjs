/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint não bloqueia o build na Vercel — lint é checado separadamente
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
