"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { TrendingUp, TrendingDown, Target, Sparkles } from "lucide-react";
import { getMonthExpenses, getMonthlySummary, getUserAvailableMonths } from "@/actions/expenses";
import { getSettings } from "@/actions/settings";
import { SavingsChart } from "@/components/insights/savings-chart";
import { useAuth } from "@/components/providers/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { MonthSelector } from "@/components/ui/month-selector";
import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const selectedMonthStr = format(selectedDate, "yyyy-MM");
  const currentMonthStr = format(now, "yyyy-MM");

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["insights", user?.uid, selectedMonthStr],
    queryFn: async () => {
      if (!user) return null;
      if (process.env.NODE_ENV === "development") {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const [expenses, summary, settings, availableMonths] = await Promise.all([
        getMonthExpenses(user.uid, selectedMonthStr),
        getMonthlySummary(user.uid, selectedMonthStr),
        getSettings(user.uid),
        getUserAvailableMonths(user.uid),
      ]);
      return { expenses, summary, settings, availableMonths };
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 10,
  });

  const loading = authLoading || queryLoading;
  const expenses = data?.expenses || [];
  const settings = data?.settings || null;
  const availableMonths = data?.availableMonths || [];

  // Calculate Insights Metrics
  const metrics = useMemo(() => {
    const isCurrentMonth = selectedMonthStr === currentMonthStr;
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    if (!settings) {
      return {
        avgSpend: 0,
        projectedEnd: 0,
        bestDay: { date: "-", amount: 0, count: 0 },
        worstDay: { date: "-", amount: 0, count: 0 },
        chartData: []
      };
    }

    const dayMap = new Map(expenses.map((e: any) => [e.date, e]));
    
    // Determine till which date to show chart data
    let maxDayToInclude = allDaysInMonth.length;
    if (isCurrentMonth) {
      maxDayToInclude = now.getDate();
    } else {
      // For past month, find last date with entry, or all days if entries exist
      let lastEntryDay = 0;
      expenses.forEach((e) => {
        const dNum = parseInt(e.date.split("-")[2], 10);
        if (dNum > lastEntryDay) lastEntryDay = dNum;
      });
      maxDayToInclude = lastEntryDay > 0 ? lastEntryDay : allDaysInMonth.length;
    }

    const activeDaysInMonth = allDaysInMonth.slice(0, maxDayToInclude);

    let totalSpentSoFar = 0;
    const recordedDays: { date: string; spent: number; saved: number }[] = [];

    const chartData = activeDaysInMonth.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const exp = dayMap.get(dateStr);
      const spent = exp?.spent || 0;
      const saved = exp ? exp.saved : settings.dailyBudget;
      const hasEntry = exp && (exp.spent > 0 || (exp.note && exp.note.trim() !== ""));

      if (hasEntry || exp) {
        totalSpentSoFar += spent;
        recordedDays.push({ date: dateStr, spent, saved });
      }

      return {
        date: dateStr,
        saved: saved,
      };
    });

    const currentDayNum = activeDaysInMonth.length || 1;
    const daysInMonthTotal = allDaysInMonth.length;
    const avgSpend = currentDayNum > 0 ? Math.round(totalSpentSoFar / currentDayNum) : 0;
    const projectedEnd = Math.round(avgSpend * daysInMonthTotal);

    // Calculate Best Day (Most money saved)
    let bestDayObj = { date: "-", amount: 0, count: 0 };
    let worstDayObj = { date: "-", amount: 0, count: 0 };

    if (recordedDays.length > 0) {
      const maxSaved = Math.max(...recordedDays.map((d) => d.saved));
      const bestMatches = recordedDays.filter((d) => d.saved === maxSaved);

      let bestDateLabel = "-";
      if (bestMatches.length === 1) {
        bestDateLabel = format(new Date(`${bestMatches[0].date}T00:00:00`), "d MMM");
      } else if (bestMatches.length === 2) {
        bestDateLabel = `${format(new Date(`${bestMatches[0].date}T00:00:00`), "d")} & ${format(new Date(`${bestMatches[1].date}T00:00:00`), "d MMM")}`;
      } else {
        bestDateLabel = `${bestMatches.map((m) => format(new Date(`${m.date}T00:00:00`), "d")).slice(0, 3).join(", ")}${bestMatches.length > 3 ? ` +${bestMatches.length - 3}` : ""} ${format(new Date(`${bestMatches[0].date}T00:00:00`), "MMM")}`;
      }

      bestDayObj = {
        date: bestDateLabel,
        amount: maxSaved,
        count: bestMatches.length,
      };

      // Worst Day (Least money saved / Most overspent)
      const minSaved = Math.min(...recordedDays.map((d) => d.saved));
      const worstMatches = recordedDays.filter((d) => d.saved === minSaved);

      let worstDateLabel = "-";
      if (worstMatches.length === 1) {
        worstDateLabel = format(new Date(`${worstMatches[0].date}T00:00:00`), "d MMM");
      } else if (worstMatches.length === 2) {
        worstDateLabel = `${format(new Date(`${worstMatches[0].date}T00:00:00`), "d")} & ${format(new Date(`${worstMatches[1].date}T00:00:00`), "d MMM")}`;
      } else {
        worstDateLabel = `${worstMatches.map((m) => format(new Date(`${m.date}T00:00:00`), "d")).slice(0, 3).join(", ")}${worstMatches.length > 3 ? ` +${worstMatches.length - 3}` : ""} ${format(new Date(`${worstMatches[0].date}T00:00:00`), "MMM")}`;
      }

      worstDayObj = {
        date: worstDateLabel,
        amount: minSaved,
        count: worstMatches.length,
      };
    }

    return {
      avgSpend,
      projectedEnd,
      bestDay: bestDayObj,
      worstDay: worstDayObj,
      chartData
    };
  }, [expenses, settings, selectedDate, selectedMonthStr, currentMonthStr]);

  if (authLoading || loading || !data) {
    return (
      <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-3.5 w-44 rounded" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>

        <Skeleton className="h-64 w-full rounded-2xl" />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 pb-24 space-y-4.5">
      {/* Header with Custom Month Selector */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
            Insights
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none">
            Understand your spending patterns
          </p>
        </div>

        {/* Custom Theme-Matched Month Selector Dropdown */}
        <div className="pt-0.5">
          <MonthSelector
            currentDate={selectedDate}
            onSelectMonth={(d) => setSelectedDate(d)}
            monthsList={availableMonths}
            align="right"
          />
        </div>
      </div>

      {/* 2x2 Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Avg Spend / Day */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Avg. Spend / Day</p>
            <div className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-0.5">₹{metrics.avgSpend}</p>
          <p className="text-[10px] text-zinc-400">Per recorded day</p>
        </div>

        {/* Projected End */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {selectedMonthStr === currentMonthStr ? "Projected End" : "Total Spent"}
            </p>
            <div className="h-6 w-6 rounded-lg bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-0.5">
            ₹{selectedMonthStr === currentMonthStr ? metrics.projectedEnd : data?.summary?.totalSpent || 0}
          </p>
          <p className="text-[10px] text-zinc-400">
            {selectedMonthStr === currentMonthStr ? "Estimated total" : "Monthly total"}
          </p>
        </div>

        {/* Best Day (Most money saved) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Best Day (Saved)</p>
            <div className="h-6 w-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
            {metrics.bestDay.date === "-" ? "-" : `+₹${metrics.bestDay.amount}`}
          </p>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate" title={metrics.bestDay.date}>
            {metrics.bestDay.date}
          </p>
        </div>

        {/* Worst Day (Lowest saved / Overspent) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Worst Day</p>
            <div className="h-6 w-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-lg font-bold text-rose-500 dark:text-rose-400 mb-0.5">
            {metrics.worstDay.date === "-" 
              ? "-" 
              : metrics.worstDay.amount < 0 
                ? `-₹${Math.abs(metrics.worstDay.amount)}` 
                : `+₹${metrics.worstDay.amount}`}
          </p>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate" title={metrics.worstDay.date}>
            {metrics.worstDay.date}
          </p>
        </div>
      </div>

      {/* Chart Section Header */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            Daily Savings Trend
          </h3>
          <span className="text-[10px] text-zinc-400 font-medium">
            {metrics.chartData.length} {metrics.chartData.length === 1 ? "day" : "days"} recorded
          </span>
        </div>

        {/* Chart Container */}
        <SavingsChart data={metrics.chartData} />
      </div>
    </PageWrapper>
  );
}
