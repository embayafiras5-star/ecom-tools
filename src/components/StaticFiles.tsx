import { useEffect } from "react";

const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /auth
Disallow: /dashboard

Sitemap: https://ecomtools.freebuff.app/sitemap.xml`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ecomtools.freebuff.app/</loc>
    <lastmod>2026-08-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

function serveRaw(content: string, mimeType: string) {
  useEffect(() => {
    document.open(mimeType);
    document.write(content);
    document.close();
  }, []);
  return null;
}

export function RobotsTxt() {
  return serveRaw(ROBOTS_TXT, "text/plain");
}

export function SitemapXml() {
  return serveRaw(SITEMAP_XML, "application/xml");
}
