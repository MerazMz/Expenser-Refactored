"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signup, login, requestOTP, verifyOTP, resetPasswordWithOTP, loginWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ChevronLeft,
  Sun,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) {
      setEmail(remembered);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      localStorage.setItem("remembered_email", email);
      if (isSignup) {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setIsLoading(false);
          return;
        }
        if (!agreeTerms) {
          toast.error("Please agree to the Terms of Service & Privacy Policy");
          setIsLoading(false);
          return;
        }
        const res = await signup({ email, password, displayName });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Account created successfully!");
          await refreshSession();
          router.push("/onboarding");
        }
      } else {
        const res = await login({ email, password });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Welcome back!");
          await refreshSession();
          router.push("/dashboard");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await requestOTP(email);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("OTP sent to your email!");
        setForgotStep("otp");
      }
    } catch {
      toast.error("Failed to request OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await verifyOTP(email, otp);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("OTP verified!");
        setForgotStep("reset");
      }
    } catch {
      toast.error("Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await resetPasswordWithOTP({ email, otp, newPassword });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Password reset successfully! Please login.");
        setIsForgot(false);
        setForgotStep("email");
        setPassword("");
        setNewPassword("");
      }
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      if (googleUser.email) {
        localStorage.setItem("remembered_email", googleUser.email);
        const res = await loginWithGoogle({
          email: googleUser.email,
          displayName: googleUser.displayName || undefined,
          photoURL: googleUser.photoURL || undefined,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Logged in with Google!");
          await refreshSession();
          if (res.isNewUser) {
            router.push("/onboarding");
          } else {
            router.push("/dashboard");
          }
        }
      } else {
        toast.error("Google sign-in did not return an email");
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        toast.error(error.message || "Failed to sign in with Google");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden flex-col bg-[#f7f5f0] dark:bg-black font-sans leading-relaxed tracking-normal select-none relative">
      {/* Light Rays Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Radial ambient glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60%] opacity-70 dark:opacity-40"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(34, 197, 94, 0.12) 0%, rgba(29, 63, 50, 0.04) 50%, transparent 100%)"
          }}
        />
        
        {/* Light Ray Beams */}
        <div 
          className="absolute -top-[20%] left-[10%] w-[100px] h-[150%] opacity-30 dark:opacity-15 blur-2xl transform rotate-[25deg] origin-top"
          style={{
            background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 100%)"
          }}
        />
        <div 
          className="absolute -top-[20%] right-[15%] w-[180px] h-[150%] opacity-25 dark:opacity-10 blur-3xl transform -rotate-[15deg] origin-top"
          style={{
            background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.01) 70%, transparent 100%)"
          }}
        />
        <div 
          className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[60px] h-[120%] opacity-40 dark:opacity-15 blur-xl transform rotate-[5deg] origin-top"
          style={{
            background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.01) 50%, transparent 100%)"
          }}
        />
      </div>

      {/* Back Header for Signup & Forgot Password */}
      {(isSignup || isForgot) && (
        <div className="px-5 pt-5 flex items-center justify-between z-20">
          <button
            onClick={() => {
              if (isForgot) {
                setIsForgot(false);
                setForgotStep("email");
              } else {
                setIsSignup(false);
              }
            }}
            className="h-9 w-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors shadow-2xs cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.25]" />
          </button>
        </div>
      )}

      {/* Hero Header Section */}
      <div className={cn(
        "flex flex-col items-center text-center px-6 pt-5 pb-4 transition-all duration-300 z-0",
        (isSignup || isForgot) ? "mt-1 space-y-1.5" : "space-y-3"
      )}>
        {/* Logo Branding */}
        <div className="flex items-center space-x-2">
          <Image
            src="/logo.png"
            alt="expenser logo"
            width={24}
            height={24}
            className="object-contain shrink-0"
          />
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 lowercase">
            expenser
          </h1>
        </div>

        {/* Title Taglines */}
        {!isSignup && !isForgot ? (
          <>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight leading-none">
                Track - Save - Achieve
              </p>
              {/* <p className="text-[11px] font-bold text-[#1a4a34] dark:text-emerald-400 leading-normal">
                Take control of your money.
              </p> */}
            </div>

            {/* Login Illustration Image */}
            <div className="w-full flex items-center justify-center mt-2 px-4 relative z-0 -mb-14">
              <Image
                src="/login.png"
                alt="Login Illustration"
                width={400}
                height={310}
                className="w-auto h-auto max-h-100 object-contain"
                priority
              />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {isForgot ? "Reset Password" : "Create your account"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              {isForgot
                ? "Request code to update password"
                : "Start your journey to better financial habits"}
            </p>
          </div>
        )}
      </div>

      {/* Form Card Container - overlap bottom of illustration */}
      <div className="relative z-10 -mt-8 flex-1 bg-white/80 dark:bg-zinc-900/60 border-t border-zinc-200/80 dark:border-zinc-800/60 rounded-t-[2.25rem] px-6 py-6 shadow-[0_-8px_20px_rgba(0,0,0,0.02)] overflow-y-auto">
        <AnimatePresence mode="wait">
          {isForgot ? (
            <motion.div
              key="forgot-container"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {forgotStep === "email" && (
                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Email
                    </label>
                    <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-emerald-600/10 focus-within:border-emerald-600 transition-all">
                      <Mail className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full rounded-xl bg-[#1d3f32] text-white font-bold text-xs shadow-sm hover:bg-[#163428] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Code"}
                  </Button>
                </form>
              )}

              {forgotStep === "otp" && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-1.5 text-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Enter 6-Digit OTP
                    </label>
                    <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-emerald-600/10 focus-within:border-emerald-600 transition-all">
                      <input
                        type="text"
                        placeholder="0 0 0 0 0 0"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-transparent text-center text-lg font-mono font-bold tracking-widest text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full rounded-xl bg-[#1d3f32] text-white font-bold text-xs shadow-sm hover:bg-[#163428] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Code"}
                  </Button>
                </form>
              )}

              {forgotStep === "reset" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      New Password
                    </label>
                    <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-emerald-600/10 focus-within:border-emerald-600 transition-all">
                      <Lock className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                      <input
                        type="password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full rounded-xl bg-[#1d3f32] text-white font-bold text-xs shadow-sm hover:bg-[#163428] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                  </Button>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.form
              key={isSignup ? "signup-form" : "login-form"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Welcome Titles */}
              {!isSignup && (
                <div className="pb-1 space-y-0.5">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center">
                    Welcome back 👋
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                    Login to continue to your account
                  </p>
                </div>
              )}

              {/* Full Name for Signup */}
              {isSignup && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Full Name
                  </label>
                  <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-[#1d3f32]/25 focus-within:border-[#1d3f32] transition-all">
                    <User className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-[#1d3f32]/25 focus-within:border-[#1d3f32] transition-all">
                  <Mail className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      className="text-xs font-semibold text-[#1a4a34] dark:text-emerald-400 hover:opacity-85 transition-opacity"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-[#1d3f32]/25 focus-within:border-[#1d3f32] transition-all">
                  <Lock className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={isSignup ? "Create a password" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 cursor-pointer ml-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignup && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-normal pl-0.5">
                    At least 8 characters with a number or symbol
                  </p>
                )}
              </div>

              {/* Confirm Password for Signup */}
              {isSignup && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Confirm Password
                  </label>
                  <div className="relative flex items-center bg-[#f7f5f0]/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-[#1d3f32]/25 focus-within:border-[#1d3f32] transition-all">
                    <Lock className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-semibold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 cursor-pointer ml-1"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Terms Checkbox for Signup */}
              {isSignup && (
                <label className="flex items-start space-x-2.5 py-1 px-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 accent-[#1d3f32] h-3.5 w-3.5 rounded border-zinc-300"
                  />
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 leading-normal">
                    I agree to the <span className="text-[#1a4a34] dark:text-emerald-400 underline">Terms of Service</span> and <span className="text-[#1a4a34] dark:text-emerald-400 underline">Privacy Policy</span>
                  </span>
                </label>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-[#1d3f32] hover:bg-[#163428] text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer pt-0.5"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <span>{isSignup ? "Create Account" : "Login"}</span>
                )}
              </Button>

              {/* Divider line "or continue with" */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-200/80 dark:border-zinc-800/80"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none">
                  or continue with
                </span>
                <div className="flex-grow border-t border-zinc-200/80 dark:border-zinc-800/80"></div>
              </div>

              {/* Google login only (no Apple button) */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4 mr-1 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.83 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                      <path d="M12,20.82c2.47,0 4.54,-0.82 6.06,-2.22l-3.3,-2.58c-0.92,0.62 -2.1,0.98 -3.5,0.98 -2.69,0 -4.96,-1.82 -5.77,-4.27H2.07v2.66C3.59,17.7 7.55,20.82 12,20.82z" fill="#34A853" />
                      <path d="M6.23,12.73c-0.21,-0.62 -0.33,-1.28 -0.33,-1.97s0.12,-1.35 0.33,-1.97V6.13H2.07c-0.74,1.48 -1.17,3.14 -1.17,4.9s0.43,3.42 1.17,4.9L6.23,12.73z" fill="#FBBC05" />
                      <path d="M12,5.17c1.34,0 2.55,0.46 3.5,1.36l2.62,-2.62C16.53,2.44 14.46,1.52 12,1.52 7.55,1.52 3.59,4.64 2.07,7.96l4.16,3.24C7.04,6.95 9.31,5.17 12,5.17z" fill="#EA4335" />
                    </g>
                  </svg>
                  <span>Google</span>
                </button>
              </div>

              {/* Bottom switch link */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setEmail("");
                    setPassword("");
                    setDisplayName("");
                    setConfirmPassword("");
                    setAgreeTerms(false);
                  }}
                  className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400"
                >
                  {isSignup ? (
                    <span>Already have an account? <span className="text-[#1a4a34] dark:text-emerald-400 underline">Login</span></span>
                  ) : (
                    <span>Don&apos;t have an account? <span className="text-[#1a4a34] dark:text-emerald-400 underline">Sign up</span></span>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
