import { PrismaClient, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({adapter})

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10)
  const staffPassword = await bcrypt.hash('staff123', 10)

  await prisma.user.createMany({
    data: [
      {
        name: 'Admin User',
        email: 'admin@greenline.local',
        password: adminPassword,
        role: UserRole.ADMIN,
      },
      {
        name: 'Staff User',
        email: 'staff@greenline.local',
        password: staffPassword,
        role: UserRole.STAFF,
      },
    ],
    skipDuplicates: true,
  })

  console.log('Admin and staff users seeded')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
 })
