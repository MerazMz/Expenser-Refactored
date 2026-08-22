export const API_BASE_URL = "https://expenser1.vercel.app";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  user?: any;
  token?: string;
  isNewUser?: boolean;
  settings?: any;
  accounts?: any[];
  expenses?: any[];
  streak?: number;
  cursor?: number;
  changes?: any[];
  isIncremental?: boolean;
}

export async function mobileLogin(email: string, password: string): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "LOGIN",
        payload: { email, password },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Login failed" };
    }
    return json;
  } catch (err: any) {
    console.error("Login API Error:", err);
    return { success: false, error: err.message || "Cannot connect to server" };
  }
}

export async function mobileGoogleLogin(
  email: string,
  displayName?: string,
  photoURL?: string
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "GOOGLE_LOGIN",
        payload: { email, displayName, photoURL },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Google login failed" };
    }
    return json;
  } catch (err: any) {
    console.error("Google Login API Error:", err);
    return { success: false, error: err.message || "Cannot connect to server" };
  }
}

export async function mobileSignup(
  email: string,
  password: string,
  displayName?: string
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SIGNUP",
        payload: { email, password, displayName },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Signup failed" };
    }
    return json;
  } catch (err: any) {
    console.error("Signup API Error:", err);
    return { success: false, error: err.message || "Cannot connect to server" };
  }
}

export async function mobileRequestOTP(email: string): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REQUEST_OTP",
        payload: { email },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Failed to send OTP" };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || "Cannot reach server" };
  }
}

export async function mobileVerifyOTP(email: string, otp: string): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VERIFY_OTP",
        payload: { email, otp },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Invalid OTP" };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || "Cannot reach server" };
  }
}

export async function mobileResetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "RESET_PASSWORD",
        payload: { email, otp, newPassword },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Failed to reset password" };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || "Cannot reach server" };
  }
}

export async function pullServerUserData(userId: string, cursor?: number): Promise<ApiResponse> {
  try {
    let url = `${API_BASE_URL}/api/sync?userId=${encodeURIComponent(userId)}`;
    if (cursor !== undefined && cursor > 0) {
      url += `&cursor=${cursor}`;
    }
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Failed to fetch data" };
    }
    return json;
  } catch (err: any) {
    console.error("Pull Data Error:", err);
    return { success: false, error: err.message || "Cannot connect to server" };
  }
}

export async function syncMutationWithServer(action: string, payload: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Sync mutation failed [${action}]:`, json);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Sync network error [${action}]:`, err);
    return false;
  }
}
