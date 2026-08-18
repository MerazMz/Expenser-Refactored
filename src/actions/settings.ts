"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSettings(userId: string) {
  if (!userId) return null;
  const settings = await prisma.settings.findUnique({
    where: { userId },
  });
  return settings;
}

export async function saveSettings(userId: string, data: {
  monthlyBudget: number; // Mapped to Current Balance
  dailyBudget: number;   // Mapped to Daily Budget
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
      currency: data.currency || 'INR',
      theme: data.theme || 'dark',
      dailyBudget: data.dailyBudget,
      currentMonth,
    },
    create: {
      userId,
      monthlyBudget: data.monthlyBudget,
      dailyBudget: data.dailyBudget,
      currentMonth,
      currency: data.currency || 'INR',
      theme: data.theme || 'dark',
    },
  });

  await generateMonthEntries(userId, currentMonth, data.dailyBudget);

  revalidatePath("/");
  return updatedSettings;
}

export async function generateMonthEntries(userId: string, monthStr: string, dailyBudget: number) {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const upsertPromises = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    upsertPromises.push(
      prisma.expense.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
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

export async function resetMonth(userId: string) {
  if (!userId) return;
  const settings = await prisma.settings.findUnique({ where: { userId } });
  if (!settings) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyBudget = settings.dailyBudget;

  await prisma.settings.update({
    where: { userId },
    data: { currentMonth },
  });

  const entries = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    entries.push({
      userId,
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
