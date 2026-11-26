/** @type {import('next').NextConfig} */
const isCapacitorStatic = process.env.CAPACITOR_BUILD === "1";

const nextConfig = {
  ...(isCapacitorStatic ? { output: "export" } : {}),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "loto.iq",
      },
    ],
  },
};

export default nextConfig;
