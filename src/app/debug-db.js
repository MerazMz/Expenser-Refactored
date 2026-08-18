import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true }
  });
  console.log("Users:", users);

  for (const user of users) {
    const count = await prisma.expense.count({
      where: { userId: user.id }
    });
    console.log(`User ${user.email} has ${count} expenses.`);

    const earliest = await prisma.expense.findFirst({
      where: { userId: user.id },
      orderBy: { date: "asc" }
    });
    console.log("Earliest expense:", earliest);

    const latest = await prisma.expense.findFirst({
      where: { userId: user.id },
      orderBy: { date: "desc" }
    });
    console.log("Latest expense:", latest);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
