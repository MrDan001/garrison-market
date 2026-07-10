/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fg3uwdlr4t2605wl.public.blob.vercel-storage.com', // Your unique Vercel Blob hostname
        port: '',
        pathname: '/**', // Permits all file directories inside the storage bucket
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Adjust this size based on your maximum expected upload
    },
  },
};

module.exports = nextConfig;