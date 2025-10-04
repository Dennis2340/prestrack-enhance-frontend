const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const adminName = process.env.ADMIN_NAME || 'Administrator';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, role: 'admin', passwordHash },
    create: { name: adminName, email: adminEmail, role: 'admin', passwordHash },
  });

  console.log('Seed complete:', { admin: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
