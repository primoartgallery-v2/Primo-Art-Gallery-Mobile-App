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

function buildArtworkEnquiryEmailHtml({
  enquiryId,
  artworkId,
  artworkTitle,
  collectorName,
  collectorEmail,
  collectorPhone,
  message,
  collectorUid,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Primo Art Gallery — New Acquisition Enquiry</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #17202A; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 20px auto; background: #FFFFFF; border: 1px solid #E8E2D8; border-radius: 16px; overflow: hidden; }
    .header { background-color: #17202A; padding: 28px; text-align: center; }
    .brand-eyebrow { color: #D4AF37; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .brand-title { color: #FFFFFF; font-size: 22px; font-weight: 700; margin: 0; }
    .body { padding: 32px; }
    .field-label { font-size: 11px; font-weight: 700; color: #8A857C; text-transform: uppercase; letter-spacing: 1px; margin-top: 16px; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #17202A; font-weight: 500; }
    .message-box { background-color: #FAF8F5; border-left: 3px solid #D4AF37; padding: 16px; border-radius: 6px; margin-top: 16px; font-size: 14px; line-height: 22px; white-space: pre-wrap; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #8A857C; border-top: 1px solid #E8E2D8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">Acquisition Advisory Desk</div>
      <h1 class="brand-title">New Artwork Enquiry</h1>
    </div>
    <div class="body">
      <div class="field-label">Artwork Details</div>
      <div class="field-value"><strong>${artworkTitle}</strong> (Item ID: #${artworkId})</div>

      <div class="field-label">Collector Name</div>
      <div class="field-value">${collectorName} ${collectorUid ? '<span style="color:#D4AF37; font-size:12px;">(Verified Member)</span>' : '<span style="color:#8A857C; font-size:12px;">(Guest)</span>'}</div>

      <div class="field-label">Contact Email</div>
      <div class="field-value"><a href="mailto:${collectorEmail}">${collectorEmail}</a></div>

      ${collectorPhone ? `
      <div class="field-label">Telephone / WhatsApp</div>
      <div class="field-value"><a href="tel:${collectorPhone}">${collectorPhone}</a></div>
      ` : ''}

      <div class="field-label">Enquiry Reference ID</div>
      <div class="field-value" style="font-family: monospace; font-size: 13px; color: #666;">${enquiryId}</div>

      <div class="field-label">Collector Message</div>
      <div class="message-box">${message}</div>
    </div>
    <div class="footer">
      Primo Art Gallery &bull; Curatorial &amp; Acquisition Desk &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends Artwork Acquisition Enquiry notification email via Resend.
 */
async function sendArtworkEnquiryEmail(enquiryData) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Primo Art Gallery <onboarding@resend.dev>";
  const galleryEmail = process.env.GALLERY_CONTACT_EMAIL || "contact@primoartgallery.com";

  if (!apiKey || apiKey.trim() === "") {
    console.log(`[EmailService] ------------------------------------------------------------`);
    console.log(`[EmailService] ✉️  DEV MODE ENQUIRY DISPATCH`);
    console.log(`[EmailService]     To Gallery    : ${galleryEmail}`);
    console.log(`[EmailService]     Artwork       : ${enquiryData.artworkTitle} (#${enquiryData.artworkId})`);
    console.log(`[EmailService]     From Collector: ${enquiryData.collectorName} <${enquiryData.collectorEmail}>`);
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
        to: [galleryEmail],
        reply_to: enquiryData.collectorEmail,
        subject: `[Acquisition Enquiry] ${enquiryData.artworkTitle} — ${enquiryData.collectorName}`,
        html: buildArtworkEnquiryEmailHtml(enquiryData),
        text: `New enquiry for "${enquiryData.artworkTitle}" (#${enquiryData.artworkId}) from ${enquiryData.collectorName} (${enquiryData.collectorEmail}, ${enquiryData.collectorPhone || "No phone"}):\n\n${enquiryData.message}`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[EmailService] Resend enquiry email error:", data);
      return { success: false, error: data.message };
    }

    console.log(`[EmailService] ✨ Enquiry Email Delivered Successfully to Gallery Desk! Message ID: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error("[EmailService] Enquiry email delivery notice:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmail,
  buildLuxuryOtpEmailHtml,
  sendArtworkEnquiryEmail,
  buildArtworkEnquiryEmailHtml,
};
