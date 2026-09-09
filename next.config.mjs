/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "@dnd-kit/core", "@dnd-kit/sortable"],
    // Client-side router cache: keep dynamic pages in memory for 30s so fast back/forward
    // navigation never re-fetches. The user can always hard-refresh if they need fresh data.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
