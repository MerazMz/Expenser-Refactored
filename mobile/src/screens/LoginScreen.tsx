import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import Svg, { Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { Mail, Lock, User, Eye, EyeOff, ChevronLeft, AlertCircle } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { API_BASE_URL } from "../services/api";

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

export const LoginScreen: React.FC = () => {
  const {
    login,
    loginWithGoogle,
    signup,
    requestOTP,
    verifyOTP,
    resetPassword,
    rememberedEmail,
  } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [isSignup, setIsSignup] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parseGoogleAuthUrl = (urlStr: string) => {
    try {
      const queryPart = urlStr.includes("?")
        ? urlStr.split("?")[1]
        : urlStr.includes("#")
        ? urlStr.split("#")[1]
        : "";
      const params: { [k: string]: string } = {};
      if (queryPart) {
        queryPart.split("&").forEach((pair) => {
          const [k, v] = pair.split("=");
          if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
        });
      }
      return {
        email: params.email,
        displayName: params.displayName,
        photoURL: params.photoURL,
      };
    } catch {
      return {};
    }
  };

  const processGoogleAuthCallback = async (urlStr: string) => {
    const { email: googleEmail, displayName: googleDisplayName, photoURL: googlePhotoURL } =
      parseGoogleAuthUrl(urlStr);

    if (googleEmail) {
      setIsGoogleLoading(true);
      try {
        const res = await loginWithGoogle(googleEmail, googleDisplayName, googlePhotoURL);
        if (!res.success) {
          setErrorMessage(res.error || "Unable to sign in with Google.");
        }
      } catch (e: any) {
        setErrorMessage(e.message || "Failed to complete Google login.");
      } finally {
        setIsGoogleLoading(false);
      }
    }
  };

  useEffect(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }

    // Listen for deep link redirect callbacks
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url && (url.includes("auth-callback") || url.includes("email="))) {
        processGoogleAuthCallback(url);
      }
    });

    // Check if app was opened with deep link
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && (initialUrl.includes("auth-callback") || initialUrl.includes("email="))) {
        processGoogleAuthCallback(initialUrl);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [rememberedEmail]);

  const clearErrors = () => {
    if (errorMessage) setErrorMessage(null);
  };

  const handleLoginSubmit = async () => {
    clearErrors();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || "Invalid email or password");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Unable to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async () => {
    clearErrors();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter your email and password.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      setErrorMessage("Please agree to the Terms of Service & Privacy Policy.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signup(email.trim(), password, displayName.trim());
      if (!res.success) {
        setErrorMessage(res.error || "Unable to create account.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    clearErrors();
    setIsGoogleLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: "expenser",
        path: "auth-callback",
      });

      const authUrl = `${API_BASE_URL}/auth/mobile-google?redirect_uri=${encodeURIComponent(redirectUri)}`;

      let sessionCompleted = false;
      try {
        const sessionResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (sessionResult && sessionResult.type === "success" && sessionResult.url) {
          await processGoogleAuthCallback(sessionResult.url);
          sessionCompleted = true;
          return;
        } else if (sessionResult && sessionResult.type === "dismiss") {
          sessionCompleted = true;
        }
      } catch (browserErr) {
        console.warn("WebBrowser.openAuthSessionAsync failed, trying fallback:", browserErr);
      }

      if (!sessionCompleted) {
        try {
          await WebBrowser.openBrowserAsync(authUrl);
        } catch {
          // Direct Linking without canOpenURL check (works on Android 11+)
          await Linking.openURL(authUrl);
        }
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setErrorMessage(err.message || "Failed to initiate Google sign in.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRequestOTP = async () => {
    clearErrors();
    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestOTP(email.trim());
      if (res.success) {
        setForgotStep("otp");
        Alert.alert("OTP Sent", "A 6-digit verification code was sent to your email.");
      } else {
        setErrorMessage(res.error || "No account found with this email.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    clearErrors();
    if (otp.length < 6) {
      setErrorMessage("Please enter a valid 6-digit OTP code.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await verifyOTP(email.trim(), otp.trim());
      if (res.success) {
        setForgotStep("reset");
      } else {
        setErrorMessage(res.error || "Invalid OTP code.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    clearErrors();
    if (!newPassword.trim() || newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await resetPassword(email.trim(), otp.trim(), newPassword.trim());
      if (res.success) {
        Alert.alert("Success", "Password reset successfully! Please log in.");
        setIsForgot(false);
        setForgotStep("email");
        setPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setErrorMessage(res.error || "Failed to update password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    clearErrors();
    if (isForgot) {
      if (forgotStep === "otp") {
        setForgotStep("email");
      } else if (forgotStep === "reset") {
        setForgotStep("otp");
      } else {
        setIsForgot(false);
        setForgotStep("email");
      }
    } else {
      setIsSignup(false);
    }
  };

  return (
    <View style={styles.screenContainer}>
      {/* Subtle Ambient Emerald Glow from Top */}
      <View style={styles.glowOverlay} pointerEvents="none">
        <Svg height="320" width={width} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="topGlow" cx="50%" cy="0%" rx="50%" ry="60%">
              <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
              <Stop offset="45%" stopColor="#1d3f32" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={`M 0 0 L ${width} 0 L ${width} 320 L 0 320 Z`} fill="url(#topGlow)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Back Navigation Row for Signup & Forgot */}
        {(isSignup || isForgot) && (
          <View style={styles.backNavRow}>
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              style={styles.backBtn}
            >
              <ChevronLeft size={20} color="#f4f4f5" strokeWidth={2.25} />
            </TouchableOpacity>
          </View>
        )}

        {/* Top Header & Branding */}
        <View style={styles.headerSection}>
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>expenser</Text>
          </View>

          {!isSignup && !isForgot ? (
            <View style={styles.illustrationWrapper}>
              <Text style={styles.taglineText}>Track - Save - Achieve</Text>
              <View style={styles.illustrationBox}>
                <Image
                  source={require("../../assets/login.png")}
                  style={styles.illustrationImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : (
            <View style={styles.subHeaderBox}>
              <Text style={styles.subHeaderTitle}>
                {isForgot ? "Reset Password" : "Create your account"}
              </Text>
              <Text style={styles.subHeaderSubtitle}>
                {isForgot
                  ? forgotStep === "otp"
                    ? `Code sent to ${email || "your email"}`
                    : forgotStep === "reset"
                    ? "Enter your new password"
                    : "Request code to update password"
                  : "Start your journey to better financial habits"}
              </Text>
            </View>
          )}
        </View>

        {/* Main Form Container Card */}
        <View
          style={[
            styles.formCard,
            {
              marginTop: !isSignup && !isForgot ? -115 : 12,
            },
          ]}
        >
          {/* Inline Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#f87171" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Forgot Password Flow */}
          {isForgot ? (
            <View style={styles.formStack}>
              {forgotStep === "email" && (
                <View style={styles.formStack}>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View style={styles.inputContainer}>
                      <Mail size={16} color="#71717a" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="name@example.com"
                        placeholderTextColor="#52525b"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          clearErrors();
                        }}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleRequestOTP}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    style={styles.primaryButton}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {forgotStep === "otp" && (
                <View style={styles.formStack}>
                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { textAlign: "center" }]}>
                      Enter 6-Digit OTP
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: "center",
                            fontSize: 20,
                            fontFamily: "Outfit_800ExtraBold",
                            letterSpacing: 6,
                          },
                        ]}
                        placeholder="000000"
                        placeholderTextColor="#52525b"
                        keyboardType="numeric"
                        maxLength={6}
                        value={otp}
                        onChangeText={(v) => {
                          setOtp(v);
                          clearErrors();
                        }}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleVerifyOTP}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    style={styles.primaryButton}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {forgotStep === "reset" && (
                <View style={styles.formStack}>
                  {/* New Password */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>New Password</Text>
                    <View style={styles.inputContainer}>
                      <Lock size={16} color="#71717a" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="At least 8 characters"
                        placeholderTextColor="#52525b"
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={(v) => {
                          setNewPassword(v);
                          clearErrors();
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setShowNewPassword(!showNewPassword)}
                        style={styles.eyeBtn}
                      >
                        {showNewPassword ? (
                          <EyeOff size={16} color="#71717a" />
                        ) : (
                          <Eye size={16} color="#71717a" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm New Password */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Confirm New Password</Text>
                    <View style={styles.inputContainer}>
                      <Lock size={16} color="#71717a" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Re-enter your new password"
                        placeholderTextColor="#52525b"
                        secureTextEntry={!showConfirmNewPassword}
                        value={confirmNewPassword}
                        onChangeText={(v) => {
                          setConfirmNewPassword(v);
                          clearErrors();
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        style={styles.eyeBtn}
                      >
                        {showConfirmNewPassword ? (
                          <EyeOff size={16} color="#71717a" />
                        ) : (
                          <Eye size={16} color="#71717a" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleResetPasswordSubmit}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    style={styles.primaryButton}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : isSignup ? (
            /* Signup Form */
            <View style={styles.formStack}>
              {/* Full Name */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <User size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    placeholderTextColor="#52525b"
                    value={displayName}
                    onChangeText={(v) => {
                      setDisplayName(v);
                      clearErrors();
                    }}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.inputContainer}>
                  <Mail size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearErrors();
                    }}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputContainer}>
                  <Lock size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Create a password"
                    placeholderTextColor="#52525b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      clearErrors();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color="#71717a" />
                    ) : (
                      <Eye size={16} color="#71717a" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.criteriaHint}>
                  At least 8 characters with a number or symbol
                </Text>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <Lock size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm your password"
                    placeholderTextColor="#52525b"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(v) => {
                      setConfirmPassword(v);
                      clearErrors();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} color="#71717a" />
                    ) : (
                      <Eye size={16} color="#71717a" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms Checkbox */}
              <TouchableOpacity
                onPress={() => {
                  setAgreeTerms(!agreeTerms);
                  clearErrors();
                }}
                activeOpacity={0.8}
                style={styles.termsRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: agreeTerms ? "#10b981" : "#3f3f46",
                      backgroundColor: agreeTerms ? "#10b981" : "transparent",
                    },
                  ]}
                >
                  {agreeTerms && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              {/* Create Account Button */}
              <TouchableOpacity
                onPress={handleSignupSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* OR CONTINUE WITH Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading}
                activeOpacity={0.8}
                style={styles.googleButton}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                      <Path
                        d="M21.35 11.1H12v2.7h5.38c-.24 1.28-.96 2.37-2.04 3.1v2.58h3.3c1.93-1.78 3.04-4.4 3.04-7.48 0-.6-.05-1.18-.33-1.9z"
                        fill="#4285F4"
                      />
                      <Path
                        d="M12 20.82c2.47 0 4.54-.82 6.06-2.22l-3.3-2.58c-.92.62-2.1.98-3.5.98-2.69 0-4.96-1.82-5.77-4.27H2.07v2.66C3.59 17.7 7.55 20.82 12 20.82z"
                        fill="#34A853"
                      />
                      <Path
                        d="M6.23 12.73c-.21-.62-.33-1.28-.33-1.97s.12-1.35 0.33-1.97V6.13H2.07c-.74 1.48-1.17 3.14-1.17 4.9s.43 3.42 1.17 4.9l4.16-3.2z"
                        fill="#FBBC05"
                      />
                      <Path
                        d="M12 5.17c1.34 0 2.55.46 3.5 1.36l2.62-2.62C16.53 2.44 14.46 1.52 12 1.52 7.55 1.52 3.59 4.64 2.07 7.96l4.16 3.24C7.04 6.95 9.31 5.17 12 5.17z"
                        fill="#EA4335"
                      />
                    </Svg>
                    <Text style={styles.googleButtonText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Switch Auth Link */}
              <TouchableOpacity
                onPress={() => {
                  setIsSignup(false);
                  setEmail("");
                  setPassword("");
                  setDisplayName("");
                  setConfirmPassword("");
                  setAgreeTerms(false);
                  clearErrors();
                }}
                style={styles.switchAuthRow}
              >
                <Text style={styles.switchAuthText}>
                  Already have an account? <Text style={styles.switchAuthHighlight}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Login Form */
            <View style={styles.formStack}>
              {/* Welcome Titles */}
              <View style={styles.welcomeBlock}>
                <Text style={styles.welcomeTitle}>Welcome back 👋</Text>
                <Text style={styles.welcomeSubtitle}>Login to continue to your account</Text>
              </View>

              {/* Email Field */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.inputContainer}>
                  <Mail size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearErrors();
                    }}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.fieldBlock}>
                <View style={styles.labelWithRightAction}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsForgot(true);
                      setForgotStep("email");
                      clearErrors();
                    }}
                  >
                    <Text style={styles.forgotPasswordLink}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#52525b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      clearErrors();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={17} color="#71717a" strokeWidth={1.75} />
                    ) : (
                      <Eye size={17} color="#71717a" strokeWidth={1.75} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLoginSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* OR CONTINUE WITH Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading}
                activeOpacity={0.8}
                style={styles.googleButton}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                      <Path
                        d="M21.35 11.1H12v2.7h5.38c-.24 1.28-.96 2.37-2.04 3.1v2.58h3.3c1.93-1.78 3.04-4.4 3.04-7.48 0-.6-.05-1.18-.33-1.9z"
                        fill="#4285F4"
                      />
                      <Path
                        d="M12 20.82c2.47 0 4.54-.82 6.06-2.22l-3.3-2.58c-.92.62-2.1.98-3.5.98-2.69 0-4.96-1.82-5.77-4.27H2.07v2.66C3.59 17.7 7.55 20.82 12 20.82z"
                        fill="#34A853"
                      />
                      <Path
                        d="M6.23 12.73c-.21-.62-.33-1.28-.33-1.97s.12-1.35 0.33-1.97V6.13H2.07c-.74 1.48-1.17 3.14-1.17 4.9s.43 3.42 1.17 4.9l4.16-3.2z"
                        fill="#FBBC05"
                      />
                      <Path
                        d="M12 5.17c1.34 0 2.55.46 3.5 1.36l2.62-2.62C16.53 2.44 14.46 1.52 12 1.52 7.55 1.52 3.59 4.64 2.07 7.96l4.16 3.24C7.04 6.95 9.31 5.17 12 5.17z"
                        fill="#EA4335"
                      />
                    </Svg>
                    <Text style={styles.googleButtonText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Bottom Switch Link */}
              <TouchableOpacity
                onPress={() => {
                  setIsSignup(true);
                  setEmail("");
                  setPassword("");
                  setDisplayName("");
                  setConfirmPassword("");
                  setAgreeTerms(false);
                  clearErrors();
                }}
                style={styles.switchAuthRow}
              >
                <Text style={styles.switchAuthText}>
                  Don't have an account? <Text style={styles.switchAuthHighlight}>Sign up</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>
);
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  glowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    zIndex: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    justifyContent: "space-between",
  },
  backNavRow: {
    paddingHorizontal: 22,
    marginBottom: 6,
    zIndex: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(39, 39, 42, 0.8)",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  logoImg: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  brandTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.5,
    textTransform: "lowercase",
  },
  illustrationWrapper: {
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  taglineText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  illustrationBox: {
    width: "100%",
    height: 315,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  illustrationImg: {
    width: "94%",
    height: "100%",
  },
  subHeaderBox: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  subHeaderTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  subHeaderSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12.5,
    color: "#a1a1aa",
    marginTop: 3,
    textAlign: "center",
  },
  formCard: {
    flex: 1,
    minHeight: height * 0.58,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: "rgba(63, 63, 70, 0.5)",
    backgroundColor: "rgba(18, 18, 20, 0.65)",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: Platform.OS === "ios" ? 44 : 32,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: "#f87171",
    lineHeight: 16,
  },
  formStack: {
    gap: 14,
  },
  welcomeBlock: {
    marginBottom: 4,
  },
  welcomeTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12.5,
    color: "#a1a1aa",
    marginTop: 2,
  },
  fieldBlock: {
    gap: 6,
  },
  labelWithRightAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12.5,
    color: "#ffffff",
  },
  forgotPasswordLink: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12.5,
    color: "#10b981",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(63, 63, 70, 0.6)",
    backgroundColor: "rgba(10, 10, 12, 0.7)",
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 13.5,
    color: "#ffffff",
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },
  criteriaHint: {
    fontFamily: "Outfit_400Regular",
    fontSize: 10,
    color: "#71717a",
    marginTop: 2,
    marginLeft: 2,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 2,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCheck: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Outfit_900Black",
  },
  termsText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 10.5,
    color: "#a1a1aa",
    flex: 1,
    lineHeight: 15,
  },
  termsLink: {
    color: "#10b981",
    textDecorationLine: "underline",
    fontFamily: "Outfit_700Bold",
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#1d3f32",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    fontFamily: "Outfit_700Bold",
    color: "#ffffff",
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(39, 39, 42, 0.7)",
  },
  dividerLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#71717a",
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(63, 63, 70, 0.6)",
    backgroundColor: "rgba(18, 18, 20, 0.55)",
  },
  googleButtonText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13.5,
    color: "#ffffff",
  },
  switchAuthRow: {
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 4,
  },
  switchAuthText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#a1a1aa",
  },
  switchAuthHighlight: {
    fontFamily: "Outfit_700Bold",
    color: "#10b981",
    textDecorationLine: "underline",
  },
});
