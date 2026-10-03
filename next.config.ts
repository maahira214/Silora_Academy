import type { NextConfig } from "next";

// Chat files are sent through a Server Action. Admins can raise the upload limit to 50 MB
// (Settings), so allow that plus multipart overhead. Both limits default to far less
// (1 MB / 10 MB), which would reject or cut off normal phone photos and PDFs.
const MAX_UPLOAD_BODY = "51mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: MAX_UPLOAD_BODY },
    // The sign-in redirect in src/proxy.ts runs on chat pages too, and buffers request bodies.
    proxyClientMaxBodySize: MAX_UPLOAD_BODY,
  },
};

export default nextConfig;
