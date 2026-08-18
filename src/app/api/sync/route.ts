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

    // Calculate streak
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
      const { userId, date, spent, note } = payload;
      const settings = await prisma.settings.findUnique({ where: { userId } });
      const dailyLimit = settings?.dailyBudget || 500;
      const saved = dailyLimit - spent;

      const expense = await prisma.expense.upsert({
        where: { userId_date: { userId, date } },
        update: { spent, saved, note: note || "", limit: dailyLimit },
        create: { userId, date, spent, saved, note: note || "", limit: dailyLimit },
      });

      return NextResponse.json({ success: true, expense }, { headers: corsHeaders });
    }

    if (action === "SAVE_SETTINGS") {
      const { userId, monthlyBudget, dailyBudget, currency, theme } = payload;
      const currentMonth = new Date().toISOString().slice(0, 7);

      const settings = await prisma.settings.upsert({
        where: { userId },
        update: { monthlyBudget, dailyBudget, currency, theme, currentMonth },
        create: { userId, monthlyBudget, dailyBudget, currency, theme, currentMonth },
      });

      return NextResponse.json({ success: true, settings }, { headers: corsHeaders });
    }

    if (action === "RESET_MONTH") {
      const { userId, monthStr } = payload;
      await prisma.expense.deleteMany({
        where: {
          userId,
          date: { startsWith: monthStr },
        },
      });

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
