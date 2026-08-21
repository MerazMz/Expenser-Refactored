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
    const accountId = searchParams.get("accountId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const [settings, accounts, expenses, user] = await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.findMany({
        where: accountId ? { userId, accountId } : { userId },
        orderBy: { date: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, photoURL: true, createdAt: true },
      }),
    ]);

    // Calculate streak strictly scoped to accountId if supplied
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
        accounts: accounts || [],
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
      const { userId, accountId } = payload;
      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId" },
          { status: 400, headers: corsHeaders }
        );
      }

      const [settings, accounts, expenses, user] = await Promise.all([
        prisma.settings.findUnique({ where: { userId } }),
        prisma.account.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.expense.findMany({
          where: accountId ? { userId, accountId } : { userId },
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
          accounts: accounts || [],
          expenses: expenses || [],
          streak,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "CREATE_ACCOUNT") {
      const { id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault } = payload;
      
      const accountData = {
        userId,
        name: name || "My Expenses",
        type: type || "budget",
        initialBalance: Number(initialBalance) || 0,
        monthlyBudget: Number(monthlyBudget) || 0,
        dailyBudget: Number(dailyBudget) || 0,
        currency: currency || "INR",
        color: color || "#10b981",
        icon: icon || "wallet",
        isDefault: Boolean(isDefault),
      };

      const account = id
        ? await prisma.account.upsert({
            where: { id },
            update: accountData,
            create: { id, ...accountData },
          })
        : await prisma.account.create({
            data: accountData,
          });

      return NextResponse.json({ success: true, account }, { headers: corsHeaders });
    }

    if (action === "UPDATE_ACCOUNT") {
      const { id, userId, name, type, initialBalance, monthlyBudget, dailyBudget, currency, color, icon, isDefault } = payload;
      
      if (!id) {
        return NextResponse.json({ error: "Missing account id" }, { status: 400, headers: corsHeaders });
      }

      const accountData = {
        name: name !== undefined ? name : "My Expenses",
        type: type !== undefined ? type : "budget",
        initialBalance: initialBalance !== undefined ? Number(initialBalance) : 0,
        monthlyBudget: monthlyBudget !== undefined ? Number(monthlyBudget) : 0,
        dailyBudget: dailyBudget !== undefined ? Number(dailyBudget) : 0,
        currency: currency !== undefined ? currency : "INR",
        color: color !== undefined ? color : "#10b981",
        icon: icon !== undefined ? icon : "wallet",
        isDefault: isDefault !== undefined ? Boolean(isDefault) : false,
      };

      const account = await prisma.account.upsert({
        where: { id },
        update: {
          name: name !== undefined ? name : undefined,
          type: type !== undefined ? type : undefined,
          initialBalance: initialBalance !== undefined ? Number(initialBalance) : undefined,
          monthlyBudget: monthlyBudget !== undefined ? Number(monthlyBudget) : undefined,
          dailyBudget: dailyBudget !== undefined ? Number(dailyBudget) : undefined,
          currency: currency !== undefined ? currency : undefined,
          color: color !== undefined ? color : undefined,
          icon: icon !== undefined ? icon : undefined,
          isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
        },
        create: {
          id,
          userId,
          ...accountData,
        },
      });

      return NextResponse.json({ success: true, account }, { headers: corsHeaders });
    }

    if (action === "DELETE_ACCOUNT") {
      const { id, userId } = payload;
      await prisma.account.deleteMany({
        where: { id, userId },
      });

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "SAVE_EXPENSE") {
      const { userId, accountId, date, spent, note, limit } = payload;
      const dailyLimit = limit !== undefined ? Number(limit) : 500;
      const numSpent = Number(spent) || 0;
      const saved = dailyLimit - numSpent;

      // Validate or resolve accountId
      let validAccountId = accountId;
      if (validAccountId) {
        const existingAcc = await prisma.account.findUnique({ where: { id: validAccountId } });
        if (!existingAcc) {
          validAccountId = undefined;
        }
      }
      if (!validAccountId) {
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
            }
          });
        }
        validAccountId = defAcc.id;
      }

      // Strictly isolate by (userId, accountId, date)
      const expense = await prisma.expense.upsert({
        where: { userId_accountId_date: { userId, accountId: validAccountId, date } },
        update: { spent: numSpent, saved, note: note || "", limit: dailyLimit },
        create: { userId, accountId: validAccountId, date, spent: numSpent, saved, note: note || "", limit: dailyLimit },
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

      return NextResponse.json({ success: true, settings }, { headers: corsHeaders });
    }

    if (action === "RESET_MONTH") {
      const { userId, accountId, monthStr } = payload;

      const whereClause: any = {
        userId,
        date: { startsWith: monthStr },
      };
      if (accountId) {
        whereClause.accountId = accountId;
      }

      await prisma.expense.deleteMany({
        where: whereClause,
      });

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Sync POST API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
