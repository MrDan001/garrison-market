import { MetadataRoute } from 'next'

const siteUrl = 'https://gmstock.co'

export default function sitemap(): MetadataRoute.Sitemap {
  const corePaths = [
    '',
    '/solutions',
    '/solutions/inventory-management-software',
    '/solutions/stock-management-software',
    '/solutions/small-business-management-software',
    '/solutions/retail-inventory-management',
    '/solutions/multi-location-inventory-management',
    '/solutions/sales-staff-expense-management',
  ]

  const legalPaths = [
    '/security',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/dpa',
    '/msa',
  ]

  return [
    ...corePaths.map((path, index) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: index === 0 ? 'weekly' as const : 'monthly' as const,
      priority: index === 0 ? 1 : path === '/solutions' ? 0.9 : 0.8,
    })),
    ...legalPaths.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]
}
