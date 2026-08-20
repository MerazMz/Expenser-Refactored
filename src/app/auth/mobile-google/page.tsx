"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
} from "firebase/auth";
import Image from "next/image";

function MobileGoogleAuthContent() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get("redirect_uri") || "expenser://auth-callback";
  const [status, setStatus] = useState<"idle" | "authenticating" | "redirecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appRedirectUrl, setAppRedirectUrl] = useState<string | null>(null);

  const handleSuccessfulAuth = (user: any) => {
    if (!user.email) {
      setErrorMessage("No email found in Google account.");
      setStatus("error");
      return;
    }

    setStatus("redirecting");

    const params = new URLSearchParams();
    params.set("email", user.email);
    if (user.displayName) params.set("displayName", user.displayName);
    if (user.photoURL) params.set("photoURL", user.photoURL);

    const delimiter = redirectUri.includes("?") ? "&" : "?";
    const targetUrl = `${redirectUri}${delimiter}${params.toString()}`;
    setAppRedirectUrl(targetUrl);

    // Trigger redirect to mobile app
    window.location.href = targetUrl;
  };

  // Check for redirect result on page load
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          handleSuccessfulAuth(result.user);
        }
      })
      .catch((err) => {
        console.error("Redirect auth error:", err);
        setErrorMessage(err.message || "Failed to process Google sign-in.");
        setStatus("error");
      });
  }, [redirectUri]);

  const startGoogleSignIn = async () => {
    setStatus("authenticating");
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      
      try {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          handleSuccessfulAuth(result.user);
          return;
        }
      } catch (popupErr: any) {
        if (popupErr.code === "auth/popup-blocked" || popupErr.code === "auth/cancelled-popup-request") {
          // Fall back to redirect if popup is blocked by in-app browser
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      console.error("Mobile Google Auth Error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setErrorMessage(err.message || "Failed to sign in with Google.");
        setStatus("error");
      } else {
        setStatus("idle");
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090a0d] text-white p-6 font-sans">
      <div className="w-full max-w-sm rounded-3xl bg-[#13151b] border border-[#232733] p-8 text-center shadow-2xl">
        <div className="flex items-center justify-center space-x-2 mb-6">
          <Image
            src="/logo.png"
            alt="expenser logo"
            width={28}
            height={28}
            className="object-contain"
          />
          <span className="text-xl font-black tracking-tight lowercase">expenser</span>
        </div>

        <h2 className="text-lg font-bold mb-2">Google Authentication</h2>
        <p className="text-xs text-zinc-400 mb-6">
          {status === "authenticating"
            ? "Connecting to Google..."
            : status === "redirecting"
            ? "Returning to Expenser app..."
            : status === "error"
            ? "Authentication was interrupted"
            : "Sign in with your Google account"}
        </p>

        {status === "error" && errorMessage && (
          <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800/60 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {status === "redirecting" && appRedirectUrl && (
          <div className="mb-4">
            <p className="text-xs text-zinc-400 mb-3">If you are not redirected automatically:</p>
            <a
              href={appRedirectUrl}
              className="inline-block py-2.5 px-6 rounded-xl bg-[#10b981] text-white font-bold text-xs shadow-md"
            >
              Open Expenser App
            </a>
          </div>
        )}

        {status !== "redirecting" && (
          <button
            type="button"
            onClick={startGoogleSignIn}
            disabled={status === "authenticating"}
            className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 rounded-xl bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.83 21.56,11.4 21.35,11.1z"
                fill="#4285F4"
              />
              <path
                d="M12,20.82c2.47,0 4.54,-0.82 6.06,-2.22l-3.3,-2.58c-0.92,0.62 -2.1,0.98 -3.5,0.98 -2.69,0 -4.96,-1.82 -5.77,-4.27H2.07v2.66C3.59,17.7 7.55,20.82 12,20.82z"
                fill="#34A853"
              />
              <path
                d="M6.23,12.73c-0.21,-0.62 -0.33,-1.28 -0.33,-1.97s0.12,-1.35 0.33,-1.97V6.13H2.07c-0.74,1.48 -1.17,3.14 -1.17,4.9s0.43,3.42 1.17,4.9L6.23,12.73z"
                fill="#FBBC05"
              />
              <path
                d="M12,5.17c1.34,0 2.55,0.46 3.5,1.36l2.62,-2.62C16.53,2.44 14.46,1.52 12,1.52 7.55,1.52 3.59,4.64 2.07,7.96l4.16,3.24C7.04,6.95 9.31,5.17 12,5.17z"
                fill="#EA4335"
              />
            </svg>
            <span>{status === "authenticating" ? "Signing In..." : "Continue with Google"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function MobileGoogleAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090a0d]" />}>
      <MobileGoogleAuthContent />
    </Suspense>
  );
}
