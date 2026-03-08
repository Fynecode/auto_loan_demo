import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const { PrismaClient } = pkg
export const prisma = new PrismaClient({ adapter })
