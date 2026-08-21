"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

async function resolveDefaultAccountId(userId: string): Promise<string> {
  let defAcc = await prisma.account.findFirst({ where: { userId, isDefault: true } });
  if (!defAcc) {
    defAcc = await prisma.account.findFirst({ where: { userId } });
  }
  if (!defAcc) {
    defAcc = await prisma.account.create({
      data: {
        id: `${userId}_default`,
        userId,
        name: "Daily Savings",
        type: "budget",
        initialBalance: 15000,
        monthlyBudget: 15000,
        dailyBudget: 500,
        currency: "INR",
        color: "#10b981",
        icon: "wallet",
        isDefault: true,
      },
    });
  }
  return defAcc.id;
}

export async function getSettings(userId: string) {
  if (!userId) return null;
  const settings = await prisma.settings.findUnique({
    where: { userId },
  });
  return settings;
}

export async function updateSettings(userId: string, data: {
  monthlyBudget: number;
  dailyBudget: number;
  currency?: string;
  theme?: string;
}) {
  if (!userId) throw new Error("Unauthorized");
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const updatedSettings = await prisma.settings.upsert({
    where: { userId },
    update: {
      monthlyBudget: data.monthlyBudget,
      dailyBudget: data.dailyBudget,
      currency: data.currency || 'INR',
      theme: data.theme || 'dark',
      currentMonth,
    },
    create: {
      userId,
      monthlyBudget: data.monthlyBudget,
      dailyBudget: data.dailyBudget,
      currency: data.currency || 'INR',
      currentMonth,
      theme: data.theme || 'dark',
    },
  });

  const accountId = await resolveDefaultAccountId(userId);
  await generateMonthEntries(userId, currentMonth, data.dailyBudget, accountId);

  revalidatePath("/");
  return updatedSettings;
}

export const saveSettings = updateSettings;

export async function generateMonthEntries(userId: string, monthStr: string, dailyBudget: number, accountId?: string) {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const actId = accountId || (await resolveDefaultAccountId(userId));

  const upsertPromises = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    upsertPromises.push(
      prisma.expense.upsert({
        where: { userId_accountId_date: { userId, accountId: actId, date } },
        create: {
          userId,
          accountId: actId,
          date,
          limit: dailyBudget,
          spent: 0,
          saved: 0,
          note: '',
        },
        update: {
          limit: dailyBudget,
        },
      })
    );
  }

  await prisma.$transaction(upsertPromises);
}

export async function updateTheme(userId: string, theme: string) {
  if (!userId) return;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  await prisma.settings.upsert({
    where: { userId },
    update: { theme },
    create: {
      userId,
      monthlyBudget: 0,
      dailyBudget: 0,
      currentMonth,
      theme,
    },
  });
  revalidatePath("/");
}

export async function resetMonth(userId: string, accountId?: string) {
  if (!userId) return;
  const settings = await prisma.settings.findUnique({ where: { userId } });
  if (!settings) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyBudget = settings.dailyBudget;
  const actId = accountId || (await resolveDefaultAccountId(userId));

  await prisma.settings.update({
    where: { userId },
    data: { currentMonth },
  });

  const entries = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    entries.push({
      userId,
      accountId: actId,
      date,
      limit: dailyBudget,
      spent: 0,
      saved: 0,
      note: '',
    });
  }

  await prisma.$transaction([
    prisma.expense.deleteMany({
      where: {
        userId,
        accountId: actId,
        date: { startsWith: currentMonth },
      },
    }),
    prisma.expense.createMany({
      data: entries,
    }),
  ]);
  
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/insights");
}
