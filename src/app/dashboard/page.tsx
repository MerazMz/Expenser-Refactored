"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSettings } from "@/actions/settings";
import { getTodayExpense, getMonthlySummary, getStreak } from "@/actions/expenses";
import { TodayCard } from "@/components/dashboard/today-card";
import { SpendInput } from "@/components/dashboard/spend-input";
import { MonthlySummary } from "@/components/dashboard/monthly-summary";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAuth } from "@/components/providers/auth-provider";
import { Flame, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["dashboard", user?.uid],
    queryFn: async () => {
      if (!user) return null;
      if (process.env.NODE_ENV === "development") {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const now = new Date();
      const currentMonth = format(now, "yyyy-MM");
      const [settings, todayExpense, summary, streak] = await Promise.all([
        getSettings(user.uid),
        getTodayExpense(user.uid),
        getMonthlySummary(user.uid, currentMonth),
        getStreak(user.uid)
      ]);

      if (!settings) {
        router.push("/onboarding");
        return null;
      }

      return { settings, todayExpense, summary, streak, now };
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5,
  });

  const loading = authLoading || queryLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || loading || !data) {
    return (
      <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-5 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3.5 w-12 rounded" />
          <Skeleton className="h-9 w-44 rounded-lg" />
        </div>

        <Skeleton className="h-44 w-full rounded-[2rem]" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-[2rem]" />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-5 pt-6 pb-24 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Image
            src="/logo.png"
            alt="expenser logo"
            width={24}
            height={24}
            className="object-contain shrink-0"
          />
          <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 lowercase leading-tight">
            expenser
          </h2>
        </div>

        {data.streak >= 0 && (
          <button
            onClick={() => setIsStreakModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-zinc-900 border border-[#e8e4db] dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Image
              src="/streak.gif"
              alt="streak flame"
              width={16}
              height={16}
              className={`object-contain shrink-0 ${data.streak === 0 ? "grayscale opacity-60" : ""}`}
              unoptimized
            />
            <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              {data.streak}
            </span>
          </button>
        )}
      </div>

      {/* Date Section */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 leading-normal tracking-wide">
          Today
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
          {format(data.now, "d MMM yyyy")}
        </h1>
      </div>

      {/* Content Stack */}
      <div className="space-y-4">
        <TodayCard expense={data.todayExpense} />

        <SpendInput 
          userId={user!.uid}
          initialSpent={data.todayExpense?.spent || 0} 
          initialNote={data.todayExpense?.note || ""} 
        />

        <MonthlySummary 
          summary={data.summary} 
          monthlyBudget={data.settings.monthlyBudget} 
        />
      </div>

      {/* Streak Info Modal */}
      <Dialog open={isStreakModalOpen} onOpenChange={setIsStreakModalOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-zinc-900 p-6 max-w-xs text-center border border-zinc-200/80 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-zinc-905 dark:text-zinc-100">Daily Streak</DialogTitle>
            <DialogDescription className="text-[11px] text-zinc-400">
              Keep the flame burning!
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center justify-center space-y-3">
            {/* Large streak count */}
            <div className="text-6xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
              {data.streak}
            </div>

            {/* Streak gif */}
            <div className="relative h-20 w-20 flex items-center justify-center">
              <Image
                src="/streak.gif"
                alt="Streak Animation"
                width={80}
                height={80}
                className={`object-contain ${data.streak === 0 ? "grayscale opacity-60" : ""}`}
                unoptimized
              />
            </div>

            {/* Info text */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[240px]">
              You build your streak by logging your saving expenses every single day. Keep entering your spending details daily to maintain your habits of saving and keep the flame alive!
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsStreakModalOpen(false)}
              className="h-10 w-full rounded-xl bg-[#1d3f32] hover:bg-[#153427] text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              Awesome!
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
