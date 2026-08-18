"use server";

import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123-change-this-in-prod";
const ALLOWED_DOMAINS = ["@gmail.com", "@lpu.in", "@yahoo.com", "@outlook.com"];

export async function signup(formData: any) {
  try {
    const { email, password, displayName } = formData;
    if (!email || !password) return { error: "Email and password are required" };

    const cleanEmail = email.toLowerCase().trim();
    const isAllowed = ALLOWED_DOMAINS.some(domain => cleanEmail.endsWith(domain));
    if (!isAllowed) {
      return { error: `Signup allowed only for: ${ALLOWED_DOMAINS.join(", ")}` };
    }

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    
    if (user) {
      return { error: "Email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        displayName: displayName || cleanEmail.split("@")[0],
        provider: "email",
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return { success: true, user: { uid: user.id, email: user.email, displayName: user.displayName } };
  } catch (error: any) {
    console.error("Signup error:", error);
    return { error: error.message || "Internal server error" };
  }
}

export async function loginWithGoogle(formData: { email: string; displayName?: string; photoURL?: string }) {
  try {
    const { email, displayName, photoURL } = formData;
    if (!email) return { error: "Email is required" };

    const cleanEmail = email.toLowerCase().trim();
    const isAllowed = ALLOWED_DOMAINS.some(domain => cleanEmail.endsWith(domain));
    if (!isAllowed) {
      return { error: `Google login allowed only for: ${ALLOWED_DOMAINS.join(", ")}` };
    }

    let isNewUser = false;
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          displayName: displayName || cleanEmail.split("@")[0],
          photoURL: photoURL || null,
          provider: "google",
        },
      });
    } else {
      if (!user.photoURL && photoURL) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { photoURL },
        });
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return { 
      success: true, 
      isNewUser,
      user: { uid: user.id, email: user.email, displayName: user.displayName } 
    };
  } catch (error: any) {
    console.error("Google login error:", error);
    return { error: error.message || "Internal server error" };
  }
}

export async function login(formData: any) {
  try {
    const { email, password } = formData;
    if (!email || !password) return { error: "Missing fields" };

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.password) return { error: "Invalid credentials" };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { error: "Invalid credentials" };

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return { success: true, user: { uid: user.id, email: user.email, displayName: user.displayName } };
  } catch (error: any) {
    console.error("Login error:", error);
    return { error: error.message || "Internal server error" };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
  return { success: true };
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, displayName: true, photoURL: true, createdAt: true },
    });
    if (!user) return null;
    return { 
      uid: user.id, 
      email: user.email, 
      displayName: user.displayName, 
      photoURL: user.photoURL,
      createdAt: user.createdAt.toISOString()
    };
  } catch {
    return null;
  }
}

export async function requestOTP(email: string) {
  try {
    if (!email) return { error: "Email is required" };

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) return { error: "No account found with this email" };

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL

    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetOTP: hashedOtp, resetOTPExpires: expiry },
    });

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not found. Dev OTP is:", otp);
      return { success: true, debug: true };
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { 
          name: process.env.BREVO_SENDER_NAME || "Expenser", 
          email: process.env.BREVO_SENDER_EMAIL || "noreply@expenser.com" 
        },
        to: [{ email: user.email }],
        subject: "Password Reset OTP - Expenser",
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; background: #000; color: #fff; border-radius: 20px; text-align: center;">
            <h1 style="color: #f7f5f0; font-style: italic;">EXPENSER</h1>
            <p>Your password reset code is:</p>
            <h2 style="font-size: 32px; letter-spacing: 5px; color: #f7f5f0;">${otp}</h2>
            <p style="color: #666; font-size: 12px;">This code expires in 10 minutes.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Brevo API Error response:", errText);
      let errMsg = "Failed to send email";
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errMsg = parsed.message;
      } catch {}
      return { error: errMsg };
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function verifyOTP(email: string, otp: string) {
  try {
    if (!email || !otp) return { error: "Missing fields" };

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.resetOTP || !user.resetOTPExpires) {
      return { error: "Invalid or expired OTP" };
    }

    if (new Date() > user.resetOTPExpires) {
      return { error: "Invalid or expired OTP" };
    }

    const isMatch = await bcrypt.compare(otp, user.resetOTP);
    if (!isMatch) return { error: "Invalid or expired OTP" };

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function resetPasswordWithOTP(formData: any) {
  try {
    const { email, otp, newPassword } = formData;
    if (!email || !otp || !newPassword) return { error: "Missing fields" };

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.resetOTP || !user.resetOTPExpires) {
      return { error: "Invalid or expired OTP" };
    }

    if (new Date() > user.resetOTPExpires) {
      return { error: "Invalid or expired OTP" };
    }

    const isMatch = await bcrypt.compare(otp, user.resetOTP);
    if (!isMatch) return { error: "Invalid or expired OTP" };

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOTP: null,
        resetOTPExpires: null,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
