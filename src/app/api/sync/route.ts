import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { format } from "date-fns";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const [settings, expenses, user] = await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      prisma.expense.findMany({
        where: { userId },
        orderBy: { date: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, photoURL: true, createdAt: true },
      }),
    ]);

    // Calculate streak matching web logic
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let streak = 0;
    const sortedDesc = [...expenses].sort((a, b) => (a.date > b.date ? -1 : 1));

    for (const exp of sortedDesc) {
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

    return NextResponse.json(
      {
        success: true,
        user,
        settings: settings || null,
        expenses: expenses || [],
        streak,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Sync GET API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    if (!action || !payload) {
      return NextResponse.json(
        { error: "Missing action or payload" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (action === "PULL_DATA") {
      const { userId } = payload;
      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId" },
          { status: 400, headers: corsHeaders }
        );
      }

      const [settings, expenses, user] = await Promise.all([
        prisma.settings.findUnique({ where: { userId } }),
        prisma.expense.findMany({
          where: { userId },
          orderBy: { date: "asc" },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, displayName: true, photoURL: true, createdAt: true },
        }),
      ]);

      const todayStr = format(new Date(), "yyyy-MM-dd");
      let streak = 0;
      const sortedDesc = [...expenses].sort((a, b) => (a.date > b.date ? -1 : 1));

      for (const exp of sortedDesc) {
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

      return NextResponse.json(
        {
          success: true,
          user,
          settings: settings || null,
          expenses: expenses || [],
          streak,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "SAVE_EXPENSE") {
      const { userId, date, spent, note, limit } = payload;
      const settings = await prisma.settings.findUnique({ where: { userId } });
      const dailyLimit = limit !== undefined ? Number(limit) : settings?.dailyBudget || 500;
      const numSpent = Number(spent) || 0;
      const saved = dailyLimit - numSpent;

      const expense = await prisma.expense.upsert({
        where: { userId_date: { userId, date } },
        update: { spent: numSpent, saved, note: note || "", limit: dailyLimit },
        create: { userId, date, spent: numSpent, saved, note: note || "", limit: dailyLimit },
      });

      return NextResponse.json({ success: true, expense }, { headers: corsHeaders });
    }

    if (action === "SAVE_SETTINGS") {
      const { userId, monthlyBudget, dailyBudget, currency, theme } = payload;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const numMonthly = Number(monthlyBudget);
      const numDaily = Number(dailyBudget);

      const settings = await prisma.settings.upsert({
        where: { userId },
        update: {
          monthlyBudget: numMonthly,
          dailyBudget: numDaily,
          currency: currency || "INR",
          theme: theme || "dark",
          currentMonth,
        },
        create: {
          userId,
          monthlyBudget: numMonthly,
          dailyBudget: numDaily,
          currency: currency || "INR",
          theme: theme || "dark",
          currentMonth,
        },
      });

      // Generate or update month daily entries
      const [year, month] = currentMonth.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const upsertPromises = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        upsertPromises.push(
          prisma.expense.upsert({
            where: { userId_date: { userId, date } },
            create: {
              userId,
              date,
              limit: numDaily,
              spent: 0,
              saved: numDaily,
              note: "",
            },
            update: {
              limit: numDaily,
            },
          })
        );
      }

      await prisma.$transaction(upsertPromises);

      return NextResponse.json({ success: true, settings }, { headers: corsHeaders });
    }

    if (action === "RESET_MONTH") {
      const { userId, monthStr } = payload;
      const settings = await prisma.settings.findUnique({ where: { userId } });
      const dailyBudget = settings?.dailyBudget || 500;

      const [year, month] = monthStr.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();

      const entries = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        entries.push({
          userId,
          date,
          limit: dailyBudget,
          spent: 0,
          saved: dailyBudget,
          note: "",
        });
      }

      await prisma.$transaction([
        prisma.expense.deleteMany({
          where: {
            userId,
            date: { startsWith: monthStr },
          },
        }),
        prisma.expense.createMany({
          data: entries,
        }),
      ]);

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Sync API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
