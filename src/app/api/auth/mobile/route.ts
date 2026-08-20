import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getOtpEmailHtml } from "@/lib/emailTemplate";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123-change-this-in-prod";
const ALLOWED_DOMAINS = ["@gmail.com", "@lpu.in", "@yahoo.com", "@outlook.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!action || !payload) {
      return NextResponse.json(
        { error: "Missing action or payload" },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- LOGIN ---
    if (action === "LOGIN") {
      const { email, password } = payload;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: { settings: true },
      });

      if (!user || !user.password) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401, headers: corsHeaders }
        );
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401, headers: corsHeaders }
        );
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "90d",
      });

      return NextResponse.json(
        {
          success: true,
          user: {
            uid: user.id,
            email: user.email,
            displayName: user.displayName || cleanEmail.split("@")[0],
            photoURL: user.photoURL,
            hasSettings: !!user.settings,
          },
          token,
        },
        { headers: corsHeaders }
      );
    }

    // --- GOOGLE LOGIN ---
    if (action === "GOOGLE_LOGIN") {
      const { email, displayName, photoURL } = payload;
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const isAllowed = ALLOWED_DOMAINS.some((domain) => cleanEmail.endsWith(domain));
      if (!isAllowed) {
        return NextResponse.json(
          { error: `Google login allowed only for: ${ALLOWED_DOMAINS.join(", ")}` },
          { status: 400, headers: corsHeaders }
        );
      }

      let isNewUser = false;
      let user = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: { settings: true },
      });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            email: cleanEmail,
            displayName: displayName || cleanEmail.split("@")[0],
            photoURL: photoURL || null,
            provider: "google",
          },
          include: { settings: true },
        });
      } else {
        if (!user.photoURL && photoURL) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { photoURL },
            include: { settings: true },
          });
        }
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "90d",
      });

      return NextResponse.json(
        {
          success: true,
          isNewUser,
          user: {
            uid: user.id,
            email: user.email,
            displayName: user.displayName || cleanEmail.split("@")[0],
            photoURL: user.photoURL,
            hasSettings: !!user.settings,
          },
          token,
        },
        { headers: corsHeaders }
      );
    }

    // --- SIGNUP ---
    if (action === "SIGNUP") {
      const { email, password, displayName } = payload;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const isAllowed = ALLOWED_DOMAINS.some((domain) => cleanEmail.endsWith(domain));
      if (!isAllowed) {
        return NextResponse.json(
          { error: `Signup allowed only for: ${ALLOWED_DOMAINS.join(", ")}` },
          { status: 400, headers: corsHeaders }
        );
      }

      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 400, headers: corsHeaders }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: hashedPassword,
          displayName: displayName || cleanEmail.split("@")[0],
          provider: "email",
        },
      });

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "90d",
      });

      return NextResponse.json(
        {
          success: true,
          user: {
            uid: user.id,
            email: user.email,
            displayName: user.displayName,
            hasSettings: false,
          },
          token,
        },
        { headers: corsHeaders }
      );
    }

    // --- REQUEST OTP ---
    if (action === "REQUEST_OTP") {
      const { email } = payload;
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user) {
        return NextResponse.json(
          { error: "No account found with this email" },
          { status: 404, headers: corsHeaders }
        );
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      const hashedOtp = await bcrypt.hash(otp, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetOTP: hashedOtp, resetOTPExpires: expiry },
      });

      const BREVO_API_KEY = process.env.BREVO_API_KEY;
      if (BREVO_API_KEY) {
        try {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": BREVO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: {
                name: process.env.BREVO_SENDER_NAME || "Expenser",
                email: process.env.BREVO_SENDER_EMAIL || "noreply@expenser.com",
              },
              to: [{ email: user.email }],
              subject: "Password Reset OTP - Expenser",
              htmlContent: getOtpEmailHtml(otp),
            }),
          });
        } catch (e) {
          console.error("Failed to send OTP email:", e);
        }
      }

      return NextResponse.json(
        { success: true, message: "OTP sent" },
        { headers: corsHeaders }
      );
    }

    // --- VERIFY OTP ---
    if (action === "VERIFY_OTP") {
      const { email, otp } = payload;
      if (!email || !otp) {
        return NextResponse.json(
          { error: "Missing fields" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user || !user.resetOTP || !user.resetOTPExpires || new Date() > user.resetOTPExpires) {
        return NextResponse.json(
          { error: "Invalid or expired OTP" },
          { status: 400, headers: corsHeaders }
        );
      }

      const isMatch = await bcrypt.compare(otp, user.resetOTP);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Invalid OTP code" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- RESET PASSWORD ---
    if (action === "RESET_PASSWORD") {
      const { email, otp, newPassword } = payload;
      if (!email || !otp || !newPassword) {
        return NextResponse.json(
          { error: "Missing fields" },
          { status: 400, headers: corsHeaders }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user || !user.resetOTP || !user.resetOTPExpires || new Date() > user.resetOTPExpires) {
        return NextResponse.json(
          { error: "Invalid or expired OTP" },
          { status: 400, headers: corsHeaders }
        );
      }

      const isMatch = await bcrypt.compare(otp, user.resetOTP);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Invalid OTP code" },
          { status: 400, headers: corsHeaders }
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetOTP: null,
          resetOTPExpires: null,
        },
      });

      return NextResponse.json(
        { success: true, message: "Password updated successfully" },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Mobile Auth API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
