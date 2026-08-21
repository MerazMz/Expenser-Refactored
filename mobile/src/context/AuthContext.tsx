import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  mobileLogin,
  mobileGoogleLogin,
  mobileSignup,
  mobileRequestOTP,
  mobileVerifyOTP,
  mobileResetPassword,
  pullServerUserData,
} from "../services/api";
import {
  getLocalSettings,
  saveLocalSettings,
  upsertSettingsFromServer,
  bulkUpsertExpensesFromServer,
} from "../db/sqlite";
import { initializeAutoSync, pullLatestDataFromServer } from "../services/syncManager";

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  hasSettings?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isOnboarded: boolean;
  setIsOnboarded: (val: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (
    email: string,
    displayName?: string,
    photoURL?: string
  ) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  requestOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  rememberedEmail: string;
  setRememberedEmail: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AUTH_USER_KEY = "@expenser_auth_user";
const AUTH_TOKEN_KEY = "@expenser_auth_token";
const AUTH_TIMESTAMP_KEY = "@expenser_auth_timestamp";
const REMEMBERED_EMAIL_KEY = "@expenser_remembered_email";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isOnboarded: true,
  setIsOnboarded: () => {},
  login: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  requestOTP: async () => ({ success: false }),
  verifyOTP: async () => ({ success: false }),
  resetPassword: async () => ({ success: false }),
  logout: async () => {},
  rememberedEmail: "",
  setRememberedEmail: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(true);
  const [rememberedEmail, setRememberedEmailState] = useState("");

  const refreshSession = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
      if (storedUser) {
        // Touch active timestamp on session refresh
        await AsyncStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
        const parsedUser: AuthUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Check local and remote settings
        const localSettings = await getLocalSettings(parsedUser.uid);
        if (localSettings && localSettings.monthlyBudget > 0) {
          setIsOnboarded(true);
        }

        // Pull latest from server in background
        pullLatestDataFromServer(parsedUser.uid).then(async (pulled) => {
          if (pulled) {
            const updatedSet = await getLocalSettings(parsedUser.uid);
            setIsOnboarded(!!updatedSet && updatedSet.monthlyBudget > 0);
          }
        });
      }
    } catch (e) {
      console.log("Error refreshing session:", e);
    }
  };

  useEffect(() => {
    async function loadAuth() {
      try {
        const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
        const storedEmail = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
        const storedTimestamp = await AsyncStorage.getItem(AUTH_TIMESTAMP_KEY);

        if (storedEmail) setRememberedEmailState(storedEmail);

        if (storedUser) {
          const lastActive = storedTimestamp ? parseInt(storedTimestamp, 10) : Date.now();
          const isExpired = Date.now() - lastActive > THIRTY_DAYS_MS;

          if (isExpired) {
            // Expired after 30 days of inactivity
            await AsyncStorage.removeItem(AUTH_USER_KEY);
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            await AsyncStorage.removeItem(AUTH_TIMESTAMP_KEY);
          } else {
            // Keep session active for another 30 days from now
            await AsyncStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());

            const parsedUser: AuthUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsOnboarded(true);

            initializeAutoSync(parsedUser.uid);
            pullLatestDataFromServer(parsedUser.uid);
          }
        }
      } catch (err) {
        console.log("Error loading auth:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAuth();
  }, []);

  const setRememberedEmail = async (email: string) => {
    setRememberedEmailState(email);
    await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  };

  const login = async (email: string, password: string) => {
    const res = await mobileLogin(email, password);
    if (!res.success || !res.user) {
      return { success: false, error: res.error || "Login failed" };
    }

    const authUser: AuthUser = {
      uid: res.user.uid || res.user.id,
      email: res.user.email,
      displayName: res.user.displayName,
      photoURL: res.user.photoURL,
      hasSettings: res.user.hasSettings ?? true,
    };

    // 1. Persist authentication session (keeps user logged in for 30 days)
    if (res.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
    }
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    await AsyncStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
    await setRememberedEmail(email);

    // 2. Mark onboarded and set user state
    setIsOnboarded(true);
    setUser(authUser);
    initializeAutoSync(authUser.uid);

    // 3. Fetch latest from server in background
    try {
      await pullLatestDataFromServer(authUser.uid);
    } catch (e) {
      console.log("Background pull on login:", e);
    }

    return { success: true };
  };

  const loginWithGoogle = async (
    email: string,
    displayName?: string,
    photoURL?: string
  ) => {
    const res = await mobileGoogleLogin(email, displayName, photoURL);
    if (!res.success || !res.user) {
      return { success: false, error: res.error || "Google sign-in failed" };
    }

    const authUser: AuthUser = {
      uid: res.user.uid || res.user.id,
      email: res.user.email,
      displayName: res.user.displayName,
      photoURL: res.user.photoURL,
      hasSettings: res.user.hasSettings ?? !res.isNewUser,
    };

    if (res.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
    }
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    await AsyncStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
    await setRememberedEmail(email);

    setIsOnboarded(!res.isNewUser && !!authUser.hasSettings);
    setUser(authUser);
    initializeAutoSync(authUser.uid);

    try {
      await pullLatestDataFromServer(authUser.uid);
    } catch (e) {
      console.log("Background pull on Google login:", e);
    }

    return { success: true, isNewUser: res.isNewUser };
  };

  const signup = async (email: string, password: string, displayName?: string) => {
    const res = await mobileSignup(email, password, displayName);
    if (!res.success || !res.user) {
      return { success: false, error: res.error || "Signup failed" };
    }

    const authUser: AuthUser = {
      uid: res.user.uid || res.user.id,
      email: res.user.email,
      displayName: res.user.displayName,
      hasSettings: false,
    };

    if (res.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
    }
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    await AsyncStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
    await setRememberedEmail(email);

    // New user needs onboarding setup
    setIsOnboarded(false);
    setUser(authUser);
    initializeAutoSync(authUser.uid);

    return { success: true };
  };

  const requestOTP = async (email: string) => {
    return await mobileRequestOTP(email);
  };

  const verifyOTP = async (email: string, otp: string) => {
    return await mobileVerifyOTP(email, otp);
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    return await mobileResetPassword(email, otp, newPassword);
  };

  const logout = async () => {
    setUser(null);
    setIsOnboarded(true);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_TIMESTAMP_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isOnboarded,
        setIsOnboarded,
        login,
        loginWithGoogle,
        signup,
        requestOTP,
        verifyOTP,
        resetPassword,
        logout,
        rememberedEmail,
        setRememberedEmail,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
