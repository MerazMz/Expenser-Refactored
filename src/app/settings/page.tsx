"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings, saveSettings, resetMonth, updateTheme } from "@/actions/settings";
import { getMonthExpenses, getUserAvailableMonths } from "@/actions/expenses";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  RotateCcw,
  Moon,
  Sun,
  Pencil,
  ChevronRight,
  Database,
  CheckCircle2,
  Loader2,
  LogOut
} from "lucide-react";
import { format } from "date-fns";
import { ISettings } from "@/types";
import { logout } from "@/actions/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user, refreshSession, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedExportMonth, setSelectedExportMonth] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");

  useEffect(() => {
    setMounted(true);
    if (user?.uid) {
      const fetchSettings = () => {
        getSettings(user.uid).then((data) => {
          if (data) {
            setSettings(data);
            setMonthlyBudget(data.monthlyBudget.toString());
            setDailyBudget(data.dailyBudget.toString());
            setCurrency(data.currency || "INR");
          }
        });
      };

      if (process.env.NODE_ENV === "development") {
        setTimeout(fetchSettings, 800);
      } else {
        fetchSettings();
      }
      getUserAvailableMonths(user.uid).then((months) => {
        setAvailableMonths(months);
        if (months.length > 0) {
          const current = format(new Date(), "yyyy-MM");
          if (months.includes(current)) {
            setSelectedExportMonth(current);
          } else {
            setSelectedExportMonth(months[0]);
          }
        }
      });
    }
  }, [user]);

  const handleSaveBudget = async () => {
    if (!user || !monthlyBudget || !dailyBudget) return;
    setIsSaving(true);
    try {
      const updated = await saveSettings(user.uid, {
        monthlyBudget: Number(monthlyBudget),
        dailyBudget: Number(dailyBudget),
        currency,
        theme: theme || "light",
      });
      setSettings(updated);
      toast.success("Budget updated!");
      setIsBudgetModalOpen(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (user?.uid) {
      updateTheme(user.uid, newTheme);
    }
  };

  const handleExport = () => {
    if (availableMonths.length === 0) {
      toast.error("No expenses available to export");
      return;
    }
    setIsExportModalOpen(true);
  };

  const handleExportConfirm = async () => {
    if (!user || !settings || !selectedExportMonth) return;
    setIsExporting(true);
    try {
      const expenses = await getMonthExpenses(user.uid, selectedExportMonth);
      exportToExcel(expenses, selectedExportMonth, settings.monthlyBudget);
      
      const [year, month] = selectedExportMonth.split("-");
      const formattedMonth = format(new Date(Number(year), Number(month) - 1, 1), "MMMM yyyy");
      toast.success(`Exported ${formattedMonth} to Excel!`);
      setIsExportModalOpen(false);
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetMonth = async () => {
    if (!user) return;
    if (resetConfirmText !== "CONFIRM") {
      toast.error("Please type CONFIRM to proceed");
      return;
    }
    setIsResetting(true);
    try {
      await resetMonth(user.uid);
      toast.success("Current month entries reset");
      setIsResetDialogOpen(false);
      setResetConfirmText("");
      const data = await getSettings(user.uid);
      if (data) setSettings(data);
    } catch {
      toast.error("Failed to reset month");
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) {
      return;
    }
    await logout();
    await refreshSession();
    toast.success("Logged out");
    router.push("/login");
  };

  if (authLoading || !settings) {
    return (
      <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 pb-24 space-y-4">
        {/* Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>

        {/* User Card */}
        <Skeleton className="h-16 w-full rounded-2xl" />

        {/* Budget Card */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-16 rounded" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>

        {/* Preferences */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>

        {/* Data & Export */}
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col bg-[#f7f5f0] dark:bg-black px-4 pt-6 pb-24 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
          Settings
        </h1>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none">
          Manage your preferences
        </p>
      </div>

      {/* User Profile Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-2xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {user?.photoURL ? (
            <div className="h-10 w-10 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <Image
                src={user.photoURL}
                alt="Profile"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#18181b] text-white font-bold flex items-center justify-center text-sm uppercase">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "M"}
            </div>
          )}

          <div>
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {user?.displayName || "Meraz Haque"}
            </h2>
            <p className="text-[10px] text-zinc-400">
              {user?.email || "merazhaque74663@gmail.com"}
            </p>
          </div>
        </div>

        <button onClick={handleLogout} className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer" title="Logout">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Budgeting Section */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 px-1">Budgeting</p>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Current Balance</p>
              <p className="text-[10px] text-zinc-400">Total remaining funds</p>
            </div>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{settings?.monthlyBudget || 0}</span>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/60 my-1" />

          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Daily Budget</p>
              <p className="text-[10px] text-zinc-400">Day-wise spending limit</p>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{settings?.dailyBudget || 0}</span>
              <button 
                onClick={() => setIsBudgetModalOpen(true)}
                className="h-7 w-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 px-1">Preferences</p>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800/60 shadow-2xs">
          {/* Dark Mode Toggle */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {mounted && theme === "dark" ? (
                <Moon className="h-4 w-4 text-zinc-400" />
              ) : (
                <Sun className="h-4 w-4 text-zinc-400" />
              )}
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Dark Mode</span>
            </div>

            <button 
              onClick={handleToggleTheme}
              className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                mounted && theme === "dark" ? "bg-emerald-500 justify-end" : "bg-zinc-200 dark:bg-zinc-700 justify-start"
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </button>
          </div>

          {/* Currency */}
          <div className="p-3 flex items-center justify-between cursor-pointer">
            <div className="flex items-center space-x-2.5">
              <Database className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Currency</span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>INR (₹)</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Data & Export Section */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 px-1">Data & Export</p>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800/60 shadow-2xs">
          {/* Export to Excel */}
          <div 
            onClick={handleExport}
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              <Download className="h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Export to Excel</p>
                <p className="text-[10px] text-zinc-400">Monthly summary sheet</p>
              </div>
            </div>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
          </div>

          {/* Reset Current Month */}
          <div 
            onClick={() => {
              setResetConfirmText("");
              setIsResetDialogOpen(true);
            }}
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center space-x-2.5">
              <RotateCcw className="h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Reset Current Month</p>
                <p className="text-[10px] text-zinc-400">Regenerate all daily entries</p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Footer Badge */}
      <div className="flex justify-center pt-1">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-[#15803d] dark:text-emerald-400 text-[10px] font-bold tracking-wide">
          <CheckCircle2 className="h-3 w-3" />
          <span>v1.0.0 • Production Ready</span>
        </div>
      </div>

      {/* Edit Budget Modal */}
      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-zinc-900 p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">Configure Budgets</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Set custom limits for your account balance and daily spending.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Current Balance</label>
              <Input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="5000"
                className="h-11 border-zinc-200 dark:border-zinc-800 font-bold text-sm bg-[#f7f5f0] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Daily Budget</label>
              <Input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                placeholder="200"
                className="h-11 border-zinc-200 dark:border-zinc-800 font-bold text-sm bg-[#f7f5f0] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsBudgetModalOpen(false)}
              className="h-10 flex-1 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button
              onClick={handleSaveBudget}
              disabled={isSaving}
              className="h-10 flex-1 rounded-xl bg-[#1b4332] hover:bg-[#153427] text-white font-bold text-xs cursor-pointer"
            >
              {isSaving ? <Loader2 className="animate-spin text-white" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-zinc-900 p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">Reset Month Entries?</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              This will reset all daily spending entries for the current month.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              Type <span className="font-extrabold text-zinc-900 dark:text-zinc-100 select-all">CONFIRM</span> to verify:
            </label>
            <Input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="CONFIRM"
              className="h-10 border-zinc-200 dark:border-zinc-800 font-bold text-xs bg-[#f7f5f0] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 uppercase"
            />
          </div>

          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsResetDialogOpen(false);
                setResetConfirmText("");
              }}
              className="h-10 flex-1 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button
              onClick={handleResetMonth}
              disabled={isResetting || resetConfirmText !== "CONFIRM"}
              className="h-10 flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? <Loader2 className="animate-spin text-white" /> : "Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export to Excel Month Select Dialog */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-zinc-900 p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">Export Transactions</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Select the month you wish to export to an Excel spreadsheet.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Select Month</label>
            <select
              value={selectedExportMonth}
              onChange={(e) => setSelectedExportMonth(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#f7f5f0] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
            >
              {availableMonths.map((mStr) => {
                const [y, m] = mStr.split("-").map(Number);
                const d = new Date(y, m - 1, 1);
                return (
                  <option key={mStr} value={mStr}>
                    {format(d, "MMMM yyyy")}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(false)}
              className="h-10 flex-1 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button
              onClick={handleExportConfirm}
              disabled={isExporting}
              className="h-10 flex-1 rounded-xl bg-[#1b4332] hover:bg-[#153427] text-white font-bold text-xs cursor-pointer"
            >
              {isExporting ? <Loader2 className="animate-spin text-white" /> : "Export Sheet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
