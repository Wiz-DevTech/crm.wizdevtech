import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@wizdevtech.com',
      role: 'ADMIN',
      // Add password hash
    }
  });

  // Create default roles
  await prisma.role.createMany({
    data: [
      { name: 'ADMIN', permissions: ['*'] },
      { name: 'MANAGER', permissions: ['read', 'write'] },
      { name: 'USER', permissions: ['read'] }
    ]
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());