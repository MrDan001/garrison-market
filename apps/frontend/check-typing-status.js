const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DB_URL } } });

prisma.typingStatus.count()
  .then((c) => console.log('TypingStatus table exists. Row count:', c))
  .catch((e) => console.log('Query failed:', e.message))
  .finally(() => prisma.$disconnect());
