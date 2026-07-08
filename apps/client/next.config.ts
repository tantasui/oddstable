import type { NextConfig } from 'next';
import path from 'path';

const config: NextConfig = {
  transpilePackages: ['@oddstable/rules'],
  // Needed for monorepo deployments (Vercel, Docker) — tells Next.js the real repo root
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default config;
