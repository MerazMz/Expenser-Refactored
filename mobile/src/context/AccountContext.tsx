import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  Account,
  getLocalAccounts,
  saveLocalAccount,
  deleteLocalAccount,
  getActiveAccountId,
  setActiveAccountId,
} from "../db/sqlite";
import { useAuth } from "./AuthContext";
import { subscribeSyncUpdates } from "../services/syncManager";

interface AccountContextType {
  accounts: Account[];
  activeAccount: Account | null;
  isLoadingAccounts: boolean;
  isSwitcherOpen: boolean;
  isCreateModalOpen: boolean;
  editingAccount: Account | null;
  refreshAccounts: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  createAccount: (data: {
    name: string;
    type: "budget" | "flex";
    initialBalance: number;
    dailyBudget?: number;
    currency?: string;
    color?: string;
    icon?: string;
  }) => Promise<Account>;
  updateAccount: (account: Account) => Promise<Account>;
  deleteAccount: (accountId: string) => Promise<void>;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  openCreateModal: () => void;
  openEditModal: (account: Account) => void;
  closeCreateModal: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const refreshAccounts = useCallback(async () => {
    if (!user?.uid) {
      setAccounts([]);
      setActiveAccount(null);
      setIsLoadingAccounts(false);
      return;
    }

    try {
      const localAccs = await getLocalAccounts(user.uid);
      setAccounts(localAccs);

      const activeId = await getActiveAccountId(user.uid);
      const current = localAccs.find((a) => a.id === activeId) || localAccs[0] || null;
      setActiveAccount(current);
    } catch (e) {
      console.error("Error loading accounts:", e);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  useEffect(() => {
    const unsub = subscribeSyncUpdates(() => {
      refreshAccounts();
    });
    return unsub;
  }, [refreshAccounts]);

  const switchAccount = async (accountId: string) => {
    if (!user?.uid) return;
    try {
      await setActiveAccountId(user.uid, accountId);
      const matched = accounts.find((a) => a.id === accountId);
      if (matched) {
        setActiveAccount(matched);
      }
      setIsSwitcherOpen(false);
    } catch (e) {
      console.error("Error switching account:", e);
    }
  };

  const createAccount = async (data: {
    name: string;
    type: "budget" | "flex";
    initialBalance: number;
    dailyBudget?: number;
    currency?: string;
    color?: string;
    icon?: string;
  }) => {
    if (!user?.uid) throw new Error("User not authenticated");
    const newAcc = await saveLocalAccount({
      userId: user.uid,
      name: data.name,
      type: data.type,
      initialBalance: data.initialBalance,
      monthlyBudget: data.type === "budget" ? data.initialBalance : 0,
      dailyBudget: data.dailyBudget || (data.type === "budget" ? 500 : 0),
      currency: data.currency || "INR",
      color: data.color || (data.type === "flex" ? "#3b82f6" : "#10b981"),
      icon: data.icon || (data.type === "flex" ? "utensils" : "wallet"),
      isDefault: accounts.length === 0 ? 1 : 0,
    });

    await refreshAccounts();
    await switchAccount(newAcc.id);
    setIsCreateModalOpen(false);
    setEditingAccount(null);
    return newAcc;
  };

  const updateAccount = async (account: Account) => {
    if (!user?.uid) throw new Error("User not authenticated");
    const updated = await saveLocalAccount(account);
    await refreshAccounts();
    if (activeAccount?.id === updated.id) {
      setActiveAccount(updated);
    }
    setIsCreateModalOpen(false);
    setEditingAccount(null);
    return updated;
  };

  const deleteAccount = async (accountId: string) => {
    if (!user?.uid) return;
    if (accounts.length <= 1) {
      throw new Error("You must have at least one active account.");
    }
    await deleteLocalAccount(user.uid, accountId);
    await refreshAccounts();
  };

  const openSwitcher = () => setIsSwitcherOpen(true);
  const closeSwitcher = () => setIsSwitcherOpen(false);

  const openCreateModal = () => {
    setEditingAccount(null);
    setIsSwitcherOpen(false);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setIsSwitcherOpen(false);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setEditingAccount(null);
    setIsCreateModalOpen(false);
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccount,
        isLoadingAccounts,
        isSwitcherOpen,
        isCreateModalOpen,
        editingAccount,
        refreshAccounts,
        switchAccount,
        createAccount,
        updateAccount,
        deleteAccount,
        openSwitcher,
        closeSwitcher,
        openCreateModal,
        openEditModal,
        closeCreateModal,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
