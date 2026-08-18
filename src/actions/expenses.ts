"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

export async function getTodayExpense(userId: string) {
  if (!userId) return null;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  
  let expense = await prisma.expense.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  
  if (!expense) {
    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (settings) {
      expense = await prisma.expense.upsert({
        where: { userId_date: { userId, date: today } },
        create: { 
          userId,
          date: today, 
          limit: settings.dailyBudget, 
          spent: 0, 
          saved: settings.dailyBudget, 
          note: '' 
        },
        update: {},
      });
    }
  }

  return expense;
}

export async function saveTodayExpense(userId: string, spent: number, note?: string) {
  if (!userId) return null;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  return saveExpense(userId, today, spent, note);
}

export async function saveExpense(userId: string, date: string, spent: number, note?: string) {
  if (!userId) throw new Error("Unauthorized");
  
  const currentExpense = await prisma.expense.findUnique({
    where: { userId_date: { userId, date } },
  });
  
  let limit = currentExpense?.limit || 0;
  if (!currentExpense) {
    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (settings) {
      limit = settings.dailyBudget;
    }
  }
  const saved = limit - spent;

  const expense = await prisma.expense.upsert({
    where: { userId_date: { userId, date } },
    update: { spent, saved, note: note || '' },
    create: {
      userId,
      date,
      limit,
      spent,
      saved,
      note: note || '',
    },
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  return expense;
}

export async function getMonthExpenses(userId: string, monthStr: string) {
  if (!userId) return [];
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { startsWith: monthStr },
    },
    orderBy: { date: 'asc' },
  });

  return expenses;
}

export async function getMonthlySummary(userId: string, monthStr: string) {
  if (!userId) return { totalSpent: 0, totalSaved: 0, totalLimit: 0, totalLimitTillNow: 0 };
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { startsWith: monthStr },
    },
  });

  const summary = expenses.reduce((acc, curr) => {
    acc.totalSpent += curr.spent || 0;
    
    const hasEntry = curr.spent > 0 || (curr.note && curr.note.trim() !== "");
    
    if (curr.date <= todayStr && (hasEntry || curr.saved > 0)) {
      acc.totalSaved += curr.saved || 0;
      acc.totalLimitTillNow += curr.limit || 0;
    }
    
    acc.totalLimit += curr.limit || 0;
    return acc;
  }, { totalSpent: 0, totalSaved: 0, totalLimit: 0, totalLimitTillNow: 0 });

  return summary;
}

export async function getExpenseByDate(userId: string, date: string) {
  if (!userId) return null;
  const expense = await prisma.expense.findUnique({
    where: { userId_date: { userId, date } },
  });
  return expense;
}

export async function getStreak(userId: string) {
  if (!userId) return 0;
  
  const expenses = await prisma.expense.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });
    
  const todayStr = format(new Date(), "yyyy-MM-dd");
  let streak = 0;
  
  for (const exp of expenses) {
    if (exp.date > todayStr) continue;
    
    const hasData = exp.spent > 0 || (exp.note && exp.note.trim() !== "");
    
    if (hasData) {
      if (exp.saved >= 0) {
        streak++;
      } else {
        break;
      }
    } else {
      if (exp.date < todayStr) {
        break;
      }
      continue;
    }
  }
  return streak;
}

export async function getUserAvailableMonths(userId: string) {
  if (!userId) return [];
  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");

  const [earliestExpense, user] = await Promise.all([
    prisma.expense.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
  ]);

  let earliestMonth = currentMonth;
  if (earliestExpense?.date) {
    const expMonth = earliestExpense.date.slice(0, 7);
    if (expMonth < earliestMonth) earliestMonth = expMonth;
  }
  if (user?.createdAt) {
    const userMonth = format(user.createdAt, "yyyy-MM");
    if (userMonth < earliestMonth) earliestMonth = userMonth;
  }

  const months: string[] = [];
  const [currentY, currentM] = currentMonth.split("-").map(Number);
  const [targetY, targetM] = earliestMonth.split("-").map(Number);

  let y = currentY;
  let m = currentM;

  while (y > targetY || (y === targetY && m >= targetM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }

  if (months.length === 0) months.push(currentMonth);
  return months;
}
