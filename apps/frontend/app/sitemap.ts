import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    '',
    '/security',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/dpa',
    '/msa',
  ]

  return publicPaths.map((path, index) => ({
    url: `https://gmstock.co${path}`,
    lastModified: new Date(),
    changeFrequency: index === 0 ? 'weekly' : 'yearly',
    priority: index === 0 ? 1 : 0.4,
  }))
}
