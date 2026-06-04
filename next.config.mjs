/** @type {import('next').NextConfig} */
const nextConfig = {
  // Toggle with REACT_COMPILER=false to confirm the bug goes away.
  reactCompiler: process.env.REACT_COMPILER !== 'false',
  productionBrowserSourceMaps: true,
};

export default nextConfig;
