"use client";

import { useState } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isToday, 
  getDay, 
  addMonths, 
  subMonths,
} from "date-fns";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  CreditCard, 
  Tag, 
  Trash2,
  Wallet,
  TrendingUp,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { getMonthExpenses, saveExpense, getMonthlySummary, getUserAvailableMonths } from "@/actions/expenses";
import { getSettings } from "@/actions/settings";
import { cn } from "@/lib/utils";
import { IExpense } from "@/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonthSelector } from "@/components/ui/month-selector";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<IExpense | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editSpent, setEditSpent] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const monthStr = format(currentDate, "yyyy-MM");
  const now = new Date();
  const isCurrentMonth = format(now, "yyyy-MM") === monthStr;

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["calendar", user?.uid, monthStr],
    queryFn: async () => {
      if (!user) return null;
      if (process.env.NODE_ENV === "development") {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const [expenses, summary, settings, availableMonths] = await Promise.all([
        getMonthExpenses(user.uid, monthStr),
        getMonthlySummary(user.uid, monthStr),
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
  const summary = data?.summary || null;
  const settings = data?.settings || null;
  const availableMonths = data?.availableMonths || [];

  const monthlyBudget = settings?.monthlyBudget || 0;
  const spent = summary?.totalSpent || 0;
  const saved = summary?.totalSaved || 0;
  const left = Math.max(0, monthlyBudget - spent);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Monday start idx (0: Mon, 1: Tue, ..., 6: Sun)
  const startDayIdx = (getDay(monthStart) + 6) % 7;

  const handlePrevMonth = () => {
    const prevDate = subMonths(currentDate, 1);
    const prevMonthStr = format(prevDate, "yyyy-MM");
    if (availableMonths.length === 0 || availableMonths.includes(prevMonthStr) || prevMonthStr >= availableMonths[availableMonths.length - 1]) {
      setCurrentDate(prevDate);
    } else {
      toast.info("No earlier records available");
    }
  };

  const handleNextMonth = () => {
    const nextDate = addMonths(currentDate, 1);
    if (nextDate <= new Date() || format(nextDate, "yyyy-MM") <= format(new Date(), "yyyy-MM")) {
      setCurrentDate(nextDate);
    }
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const expense = expenses.find((e: IExpense) => e.date === dateStr);
    const dailyLimit = settings?.dailyBudget || 0;
    
    const targetExpense: IExpense = expense || {
      userId: user?.uid || "",
      date: dateStr,
      limit: dailyLimit,
      spent: 0,
      saved: dailyLimit,
      note: "",
    };

    setSelectedDay(targetExpense);
    const hasData = expense && (expense.spent > 0 || (expense.note && expense.note.trim() !== ""));
    setEditSpent(hasData ? expense.spent.toString() : "");
    setEditNote(expense?.note || "");
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDay || !user) return;
    setIsSaving(true);
    try {
      const numSpent = editSpent === "" ? 0 : Number(editSpent);
      await saveExpense(user.uid, selectedDay.date, isNaN(numSpent) ? 0 : numSpent, editNote);
      toast.success("Updated successfully");
      setIsSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["calendar", user.uid, monthStr] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["insights", user.uid] });
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || loading || !data) {
    return (
      <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 space-y-5">
        <div className="flex justify-center">
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 pb-24 space-y-3">
      {/* Header: Centered Month Title with Chevron Navigation at ends */}
      <div className="relative flex items-center justify-between h-9">
        <button 
          onClick={handlePrevMonth} 
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer z-10"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.25]" />
        </button>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <MonthSelector
              currentDate={currentDate}
              onSelectMonth={(d) => setCurrentDate(d)}
              monthsList={availableMonths}
              align="center"
            />
          </div>
        </div>

        <button 
          onClick={handleNextMonth} 
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer z-10"
          aria-label="Next Month"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.25]" />
        </button>
      </div>

      {/* Weekdays */}
      <div>
        <div className="grid grid-cols-7 text-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              {day}
            </div>
          ))}
        </div>

        {/* Subtle Horizontal Divider Line */}
        <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 mt-1.5 mb-2.5" />

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {/* Padding for Monday start */}
          {Array.from({ length: startDayIdx }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const expense = expenses.find((e: IExpense) => e.date === dateStr);
            const isTodayDay = isToday(day);
            const isFuture = day > new Date();

            const hasData = expense && (expense.spent > 0 || (expense.note && expense.note.trim() !== ""));
            const savedValue = expense ? expense.saved : 0;

            return (
              <div 
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className="flex flex-col items-center justify-center min-h-[46px] cursor-pointer active:scale-95 transition-transform"
              >
                {isTodayDay ? (
                  <div className="w-11 h-12 rounded-xl bg-[#18181b] dark:bg-zinc-800 dark:border dark:border-zinc-700 text-white flex flex-col items-center justify-center shadow-xs">
                    <span className="text-xs font-bold text-white">
                      {format(day, "d")}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-300">
                      {!expense || (!hasData && savedValue === 0)
                        ? "-"
                        : savedValue}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {format(day, "d")}
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold mt-0.5 tracking-tight",
                      !expense || isFuture || (!hasData && savedValue === 0) 
                        ? "text-zinc-400 dark:text-zinc-600" 
                        : savedValue >= 0 
                          ? "text-[#16a34a] dark:text-emerald-400" 
                          : "text-[#ef4444] dark:text-rose-400"
                    )}>
                      {!expense || isFuture || (!hasData && savedValue === 0)
                        ? "-"
                        : savedValue}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-5 pt-1">
        <div className="flex items-center space-x-1.5">
          <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Saved</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="h-2 w-2 rounded-full bg-[#ef4444]" />
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Overspent</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">No Entry</span>
        </div>
      </div>

      {/* Monthly Summary Section (Till Date for Current & Previous Months) */}
      <div className="pt-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            {format(currentDate, "MMMM")} Summary{isCurrentMonth ? " (Till Date)" : ""}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Budget Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-2.5 shadow-2xs flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#e8f6ed] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-[#15803d] dark:text-emerald-400 stroke-[1.75]" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Budget</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{monthlyBudget}</p>
            </div>
          </div>

          {/* Spent Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-2.5 shadow-2xs flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#fdeeee] dark:bg-rose-950/40 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-[#e11d48] dark:text-rose-400 stroke-[1.75]" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Spent</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{spent}</p>
            </div>
          </div>

          {/* Saved Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-2.5 shadow-2xs flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#e8f6ed] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-[#15803d] dark:text-emerald-400 stroke-[1.75]" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Saved</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{saved}</p>
            </div>
          </div>

          {/* Left Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-2.5 shadow-2xs flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#fdf2e2] dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-[#d97706] dark:text-amber-400 stroke-[1.75]" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Left</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{left}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent 
          side="bottom" 
          className="rounded-t-[2.25rem] bg-[#faf8f5] dark:bg-[#18181b] border-t border-[#e8e4dc] dark:border-zinc-800 px-6 pt-3 pb-8 max-w-md mx-auto shadow-2xl"
        >
          {selectedDay && (() => {
            const parsedDate = new Date(`${selectedDay.date}T00:00:00`);
            const dailyLimit = settings?.dailyBudget || selectedDay.limit || 0;
            const currentSpentNum = editSpent === "" ? 0 : Number(editSpent);
            const calculatedSaved = dailyLimit - (isNaN(currentSpentNum) ? 0 : currentSpentNum);
            const isOverspent = calculatedSaved < 0;

            return (
              <div className="space-y-4">
                {/* Drag Handle */}
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto" />

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#e8f6ed] text-[#15803d] dark:bg-emerald-950/60 dark:text-emerald-400 mb-1">
                      {format(parsedDate, "EEEE")}
                    </span>
                    <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      {format(parsedDate, "d MMMM yyyy")}
                    </h2>
                  </div>
                </div>

                {/* Mini Budget & Savings Preview */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Daily Budget</p>
                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">₹{dailyLimit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {isOverspent ? "Overspent" : "You Save"}
                    </p>
                    <p className={cn(
                      "text-base font-bold mt-0.5",
                      isOverspent ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {isOverspent ? `-₹${Math.abs(calculatedSaved)}` : `₹${calculatedSaved}`}
                    </p>
                  </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Amount Spent (₹)
                    </label>
                    <div className="relative flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-emerald-600/20 focus-within:border-emerald-600">
                      <span className="text-zinc-400 font-bold text-lg mr-2 select-none">₹</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={editSpent}
                        onChange={(e) => setEditSpent(e.target.value)}
                        className="flex-1 bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-bold text-lg focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                      />
                      <CreditCard className="h-5 w-5 text-zinc-400 stroke-[1.5] ml-2" />
                    </div>

                    {/* Quick Amount Selector Pills */}
                    <div className="flex items-center space-x-1.5 mt-2 overflow-x-auto pb-0.5">
                      {[0, 50, 100, 200, 500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditSpent(preset.toString())}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 border",
                            editSpent === preset.toString()
                              ? "bg-[#1d3f32] text-white border-[#1d3f32]"
                              : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          )}
                        >
                          {preset === 0 ? "₹0 (No spend)" : `₹${preset}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Note (optional)
                    </label>
                    <div className="relative flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-emerald-600/20 focus-within:border-emerald-600">
                      <Tag className="h-4 w-4 text-zinc-400 stroke-[1.5] mr-2.5 shrink-0" />
                      <input
                        placeholder="What did you buy? (e.g. Groceries, Coffee)"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 space-y-2">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="h-12 w-full rounded-2xl bg-[#1d3f32] hover:bg-[#163428] text-white font-semibold text-sm cursor-pointer shadow-sm active:scale-[0.99] transition-all"
                    >
                      {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Daily Record"}
                    </Button>

                    {(selectedDay.spent > 0 || (selectedDay.note && selectedDay.note.trim() !== "")) && (
                      <button
                        type="button"
                        onClick={async () => {
                          setEditSpent("0");
                          setEditNote("");
                          if (!user) return;
                          setIsSaving(true);
                          try {
                            await saveExpense(user.uid, selectedDay.date, 0, "");
                            toast.success("Record cleared");
                            setIsSheetOpen(false);
                            queryClient.invalidateQueries({ queryKey: ["calendar", user.uid, monthStr] });
                            queryClient.invalidateQueries({ queryKey: ["dashboard", user.uid] });
                            queryClient.invalidateQueries({ queryKey: ["insights", user.uid] });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="w-full py-2 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Clear record for this day</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </PageWrapper>
  );
}
