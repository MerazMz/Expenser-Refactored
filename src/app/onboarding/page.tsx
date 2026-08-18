"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { saveSettings } from "@/actions/settings";
import { toast } from "sonner";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { format } from "date-fns";

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const handleNext = () => {
    if (step === 1) {
      if (!monthlyBudget || Number(monthlyBudget) <= 0) {
        toast.error("Please enter a valid balance");
        return;
      }
      if (!dailyBudget) {
        const recommended = Math.round(Number(monthlyBudget) / daysInMonth);
        setDailyBudget(recommended.toString());
      }
      setStep(2);
    }
  };

  const handleFinish = async () => {
    if (!user || !monthlyBudget || !dailyBudget) return;
    setIsLoading(true);
    try {
      await saveSettings(user.uid, {
        monthlyBudget: Number(monthlyBudget),
        dailyBudget: Number(dailyBudget),
      });
      toast.success("Setup complete!");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] dark:bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-[#1d3f32] dark:text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f7f5f0] dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans leading-relaxed select-none">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-sm space-y-6 text-center"
          >
            {/* Header */}
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold tracking-tight lowercase text-zinc-950 dark:text-white leading-none">
                expenser
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Let&apos;s set up your starting account balance.
              </p>
            </div>

            {/* Main Input Container Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-[2rem] p-6 shadow-2xs space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                  Current Balance
                </label>
                <div className="relative flex items-center bg-[#f7f5f0] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-[#1d3f32]/20 focus-within:border-[#1d3f32] transition-all">
                  <div className="h-9 w-9 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 font-bold text-base shadow-3xs select-none mr-3 shrink-0">
                    ₹
                  </div>
                  <input
                    type="number"
                    placeholder="5000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    className="flex-1 bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-extrabold text-2xl focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Step Indicators & CTA Button */}
            <div className="space-y-4">
              {/* Dots */}
              <div className="flex justify-center space-x-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1d3f32] dark:bg-emerald-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-800" />
              </div>

              <button
                onClick={handleNext}
                className="h-12 w-full rounded-xl bg-[#1d3f32] hover:bg-[#153427] text-white font-bold text-xs cursor-pointer shadow-xs transition-all active:scale-[0.99] flex items-center justify-center space-x-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-sm space-y-6 text-center"
          >
            {/* Header */}
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-none">
                Daily Limit
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Set your custom day-wise spending limit.
              </p>
            </div>

            {/* Input Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-[2rem] p-6 shadow-2xs space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                  Daily Budget Limit
                </label>
                <div className="relative flex items-center bg-[#f7f5f0] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-[#1d3f32]/20 focus-within:border-[#1d3f32] transition-all">
                  <div className="h-9 w-9 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 font-bold text-base shadow-3xs select-none mr-3 shrink-0">
                    ₹
                  </div>
                  <input
                    type="number"
                    placeholder="200"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className="flex-1 bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-extrabold text-2xl focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 pt-1 text-center">
                  Recommended: <span className="font-semibold text-zinc-600 dark:text-zinc-300">₹{Math.round(Number(monthlyBudget) / daysInMonth)}/day</span>
                </p>
              </div>
            </div>

            {/* Action Buttons & Indicator */}
            <div className="space-y-3">
              {/* Dots */}
              <div className="flex justify-center space-x-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-800" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#1d3f32] dark:bg-emerald-400" />
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="h-12 w-full rounded-xl bg-[#1d3f32] hover:bg-[#153427] text-white font-bold text-xs cursor-pointer shadow-xs transition-all active:scale-[0.99] flex items-center justify-center space-x-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Get Started</span>
                      <Check className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
