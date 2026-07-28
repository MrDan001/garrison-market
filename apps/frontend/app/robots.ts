import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/owner/', '/admin/', '/api/', '/change-password', '/forgot-password'],
      },
    ],
    sitemap: 'https://gmstock.co/sitemap.xml',
  }
}