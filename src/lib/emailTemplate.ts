export function getOtpEmailHtml(otp: string): string {
  // Format spaced digits for fallback display
  const spacedOtp = otp.split("").join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Password Reset OTP - Expenser</title>
  <style>
    @media only screen and (max-width: 600px) {
      .card-table {
        width: 100% !important;
        border-radius: 16px !important;
      }
      .otp-code {
        font-size: 32px !important;
        letter-spacing: 8px !important;
      }
      .content-padding {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #090a0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #090a0d; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="card-table" style="max-width: 520px; background: #13151b; border: 1px solid #232733; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #10b981 0%, #059669 50%, #047857 100%);"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 20px 36px; text-align: center;">
              <!-- Brand Badge -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin-bottom: 20px;">
                <tr>
                  <td style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; padding: 6px 16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; line-height: 1; padding-right: 6px;">🔐</td>
                        <td style="font-size: 12px; font-weight: 700; color: #34d399; letter-spacing: 0.5px; text-transform: uppercase;">Security Verification</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Logo & App Name -->
              <h1 style="margin: 0 0 6px 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: lowercase;">
                expenser
              </h1>
              <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Track · Save · Achieve
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content-padding" style="padding: 0 36px 32px 36px; text-align: center;">
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                We received a request to reset your password. Use the single-use verification code below to verify your identity:
              </p>

              <!-- Interactive OTP Display Banner -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: #0d0f14; border: 1.5px dashed #10b981; border-radius: 18px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 24px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Your One-Time Password
                    </div>
                    <!-- OTP Code -->
                    <div class="otp-code" style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 38px; font-weight: 800; color: #34d399; letter-spacing: 12px; padding: 4px 0; text-align: center; text-shadow: 0 0 20px rgba(52, 211, 153, 0.35);">
                      ${spacedOtp}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                      Click & copy or enter manually in the app
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Timer Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 8px 16px;">
                    <span style="font-size: 12px; font-weight: 600; color: #fbbf24;">
                      ⏱️ Valid for 10 minutes only
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Security Advisory Card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: #171922; border-left: 3px solid #10b981; border-radius: 8px; text-align: left;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 12.5px; color: #94a3b8; line-height: 1.5;">
                      <strong style="color: #e2e8f0;">Didn't request this?</strong> You can safely ignore this email. Your password will remain unchanged, and your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background: #0d0f14; border-top: 1px solid #1e222d; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Expenser Automated Security System
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.4;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
