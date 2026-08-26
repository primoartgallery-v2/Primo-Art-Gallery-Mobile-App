/**
 * Resend Email Service for Primo Art Gallery.
 * Sends luxury, responsive HTML OTP emails to collectors via Resend REST API.
 */

function buildLuxuryOtpEmailHtml(otpCode, email) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Primo Art Gallery — Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF8F5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #17202A;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 540px;
      margin: 40px auto;
      background: #FFFFFF;
      border: 1px solid #E8E2D8;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }
    .header {
      background-color: #17202A;
      padding: 36px 24px;
      text-align: center;
    }
    .brand-eyebrow {
      color: #D4AF37;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .brand-title {
      color: #FFFFFF;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .content {
      padding: 40px 36px;
      text-align: center;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #17202A;
      margin-bottom: 12px;
    }
    .instruction {
      font-size: 14px;
      color: #6A675F;
      line-height: 22px;
      margin-bottom: 30px;
    }
    .otp-card {
      background-color: #FAF8F5;
      border: 1.5px solid #E8E2D8;
      border-radius: 16px;
      padding: 24px 20px;
      margin: 0 auto 30px;
      max-width: 320px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #9A7B38;
      margin: 0;
    }
    .badge {
      display: inline-block;
      margin-top: 10px;
      background-color: #F8F0DC;
      color: #6D5421;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 12px;
      letter-spacing: 0.5px;
    }
    .security-notice {
      font-size: 12px;
      color: #969288;
      line-height: 18px;
      border-top: 1px solid #F2ECE2;
      padding-top: 24px;
      margin-top: 10px;
    }
    .footer {
      background-color: #FAF8F5;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #E8E2D8;
      font-size: 11px;
      color: #969288;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">PRIMO ART GALLERY</div>
      <h1 class="brand-title">Collector Authentication</h1>
    </div>
    <div class="content">
      <div class="greeting">Welcome to Primo Space</div>
      <p class="instruction">
        Use the 6-digit verification code below to securely authenticate your collector account for <strong>${email}</strong>.
      </p>
      <div class="otp-card">
        <div class="otp-code">${otpCode}</div>
        <div class="badge">VALID FOR 10 MINUTES</div>
      </div>
      <div class="security-notice">
        If you did not request this verification code, please disregard this message. Never share this code with anyone.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Primo Art Gallery. All rights reserved. &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends OTP verification email via native Resend REST API.
 */
async function sendOtpEmail({ email, otpCode }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Primo Art Gallery <onboarding@resend.dev>";

  if (!apiKey || apiKey.trim() === "") {
    console.log(`[EmailService] ------------------------------------------------------------`);
    console.log(`[EmailService] ✉️  DEV MODE OTP DISPATCH`);
    console.log(`[EmailService]     To Email : ${email}`);
    console.log(`[EmailService]     OTP Code : ${otpCode}`);
    console.log(`[EmailService]     Notice   : Set RESEND_API_KEY in server/.env to send real emails`);
    console.log(`[EmailService] ------------------------------------------------------------`);
    return { success: true, mode: "local_dev" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Your Primo Art Gallery Verification Code: ${otpCode}`,
        html: buildLuxuryOtpEmailHtml(otpCode, email),
        text: `Your Primo Art Gallery verification code is: ${otpCode}. It is valid for 10 minutes. Do not share this code with anyone.`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[EmailService] Resend API error response:", data);
      throw new Error(data.message || "Failed to deliver verification email via Resend.");
    }

    console.log(`[EmailService] ✨ Real Email Delivered Successfully! Message ID: ${data.id} -> ${email}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error("[EmailService] Email dispatch failure:", err.message);
    throw err;
  }
}

module.exports = {
  sendOtpEmail,
  buildLuxuryOtpEmailHtml,
};
