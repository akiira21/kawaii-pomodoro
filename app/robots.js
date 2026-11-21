export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000';
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
