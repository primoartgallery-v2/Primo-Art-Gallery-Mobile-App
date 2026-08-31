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

function buildCollectorVipPassEmailHtml(rsvp) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Primo Art Gallery — Exhibition VIP Guest Pass</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #17202A; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 20px auto; background: #FFFFFF; border: 2px solid #D4AF37; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background-color: #17202A; padding: 30px; text-align: center; border-bottom: 2px solid #D4AF37; }
    .brand-eyebrow { color: #D4AF37; font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 6px; }
    .brand-title { color: #FFFFFF; font-size: 24px; font-weight: 700; margin: 0; }
    .body { padding: 32px; }
    .pass-card { background-color: #FAF8F5; border: 1.5px solid #E8E2D8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .pass-label { font-size: 10px; font-weight: 800; color: #8A857C; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .pass-id { font-family: monospace; font-size: 26px; font-weight: 800; color: #9A7B38; letter-spacing: 2px; margin: 0 0 8px 0; }
    .pass-badge { display: inline-block; background-color: #F8F0DC; color: #6D5421; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 12px; letter-spacing: 0.5px; }
    .field-row { display: flex; justify-content: space-between; border-bottom: 1px solid #F0ECE4; padding: 10px 0; font-size: 14px; }
    .field-name { color: #8A857C; font-weight: 600; }
    .field-val { color: #17202A; font-weight: 700; text-align: right; }
    .instructions { background-color: #FAF8F5; border-left: 3px solid #D4AF37; padding: 14px; border-radius: 6px; font-size: 13px; color: #555; margin-top: 20px; line-height: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #8A857C; border-top: 1px solid #E8E2D8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">EXHIBITION VIP GUEST PASS</div>
      <h1 class="brand-title">${rsvp.exhibitionTitle}</h1>
    </div>
    <div class="body">
      <div class="pass-card">
        <div class="pass-label">OFFICIAL VIP PASS REFERENCE</div>
        <div class="pass-id">${rsvp.passId}</div>
        <div class="pass-badge">CONFIRMED GUEST PASS &bull; ${rsvp.guestCount} ${rsvp.guestCount > 1 ? 'GUESTS' : 'GUEST'}</div>
      </div>

      <div class="field-row">
        <span class="field-name">Guest Name</span>
        <span class="field-val">${rsvp.collectorName}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Exhibition Dates</span>
        <span class="field-val">${rsvp.exhibitionDates}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Daily Timings</span>
        <span class="field-val">${rsvp.exhibitionTimings}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Venue Location</span>
        <span class="field-val">${rsvp.exhibitionVenue}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Entry Category</span>
        <span class="field-val" style="color: #9A7B38;">Complimentary VIP Admission</span>
      </div>

      <div class="instructions">
        <strong>Curatorial Check-in Notice:</strong> Please present this email or your Pass Reference ID (<strong>${rsvp.passId}</strong>) at the Primo Art Gallery reception desk upon arrival.
      </div>
    </div>
    <div class="footer">
      Primo Art Gallery &bull; Curatorial Board &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

function buildGalleryRsvpNotificationEmailHtml(rsvp) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Primo Art Gallery — New Exhibition VIP RSVP</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #17202A; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 20px auto; background: #FFFFFF; border: 1px solid #E8E2D8; border-radius: 16px; overflow: hidden; }
    .header { background-color: #17202A; padding: 24px; text-align: center; }
    .brand-eyebrow { color: #D4AF37; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .brand-title { color: #FFFFFF; font-size: 20px; font-weight: 700; margin: 0; }
    .body { padding: 28px; }
    .field-label { font-size: 11px; font-weight: 700; color: #8A857C; text-transform: uppercase; margin-top: 14px; margin-bottom: 2px; }
    .field-val { font-size: 15px; color: #17202A; font-weight: 500; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #8A857C; border-top: 1px solid #E8E2D8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">Exhibition Management Desk</div>
      <h1 class="brand-title">New VIP Exhibition RSVP</h1>
    </div>
    <div class="body">
      <div class="field-label">Exhibition</div>
      <div class="field-val"><strong>${rsvp.exhibitionTitle}</strong> (ID: #${rsvp.exhibitionId})</div>

      <div class="field-label">Pass Reference ID</div>
      <div class="field-val" style="font-family: monospace; font-weight: 700; color: #9A7B38;">${rsvp.passId}</div>

      <div class="field-label">Collector Name</div>
      <div class="field-val">${rsvp.collectorName} ${rsvp.collectorUid ? '<span style="color:#D4AF37; font-size:12px;">(Verified Member)</span>' : '<span style="color:#8A857C; font-size:12px;">(Guest)</span>'}</div>

      <div class="field-label">Collector Email</div>
      <div class="field-val"><a href="mailto:${rsvp.collectorEmail}">${rsvp.collectorEmail}</a></div>

      ${rsvp.collectorPhone ? `
      <div class="field-label">Telephone / WhatsApp</div>
      <div class="field-val"><a href="tel:${rsvp.collectorPhone}">${rsvp.collectorPhone}</a></div>
      ` : ''}

      <div class="field-label">Guest Count</div>
      <div class="field-val">${rsvp.guestCount} Person(s)</div>

      ${rsvp.message ? `
      <div class="field-label">Collector Notes</div>
      <div class="field-val" style="background:#FAF8F5; padding:10px; border-radius:6px; margin-top:4px;">${rsvp.message}</div>
      ` : ''}
    </div>
    <div class="footer">
      Primo Art Gallery &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Dispatches VIP Guest Pass confirmation email to collector and notification to gallery desk.
 */
async function sendExhibitionRsvpEmails(rsvp) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Primo Art Gallery <onboarding@resend.dev>";
  const galleryEmail = process.env.GALLERY_CONTACT_EMAIL || "contact@primoartgallery.com";

  if (!apiKey || apiKey.trim() === "") {
    console.log(`[EmailService] ------------------------------------------------------------`);
    console.log(`[EmailService] ✉️  DEV MODE EXHIBITION RSVP DISPATCH`);
    console.log(`[EmailService]     To Collector  : ${rsvp.collectorName} <${rsvp.collectorEmail}>`);
    console.log(`[EmailService]     Pass ID       : ${rsvp.passId}`);
    console.log(`[EmailService]     Exhibition    : ${rsvp.exhibitionTitle}`);
    console.log(`[EmailService]     Guest Count   : ${rsvp.guestCount}`);
    console.log(`[EmailService]     To Gallery    : ${galleryEmail}`);
    console.log(`[EmailService] ------------------------------------------------------------`);
    return { success: true, mode: "local_dev" };
  }

  try {
    // 1. Send VIP Pass to Collector
    const collectorRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [rsvp.collectorEmail],
        subject: `🎟️ Your VIP Guest Pass: ${rsvp.exhibitionTitle} — Primo Art Gallery`,
        html: buildCollectorVipPassEmailHtml(rsvp),
        text: `Your VIP Guest Pass for "${rsvp.exhibitionTitle}" is confirmed!\n\nPass Reference: ${rsvp.passId}\nGuest Count: ${rsvp.guestCount}\nDates: ${rsvp.exhibitionDates}\nVenue: ${rsvp.exhibitionVenue}\n\nPlease present this Pass Reference at the gallery reception desk upon arrival.`,
      }),
    });

    if (collectorRes.ok) {
      const collectorData = await collectorRes.json();
      console.log(`[EmailService] ✨ VIP Pass Email Delivered to Collector! Message ID: ${collectorData.id}`);
    }

    // 2. Send Notification to Gallery Desk
    const galleryRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [galleryEmail],
        reply_to: rsvp.collectorEmail,
        subject: `[Exhibition RSVP] ${rsvp.exhibitionTitle} — ${rsvp.collectorName} (${rsvp.guestCount} Guests)`,
        html: buildGalleryRsvpNotificationEmailHtml(rsvp),
        text: `New VIP RSVP for "${rsvp.exhibitionTitle}"\nPass ID: ${rsvp.passId}\nCollector: ${rsvp.collectorName} (${rsvp.collectorEmail})\nGuests: ${rsvp.guestCount}`,
      }),
    });

    if (galleryRes.ok) {
      const galleryData = await galleryRes.json();
      console.log(`[EmailService] ✨ Exhibition RSVP Notification Delivered to Gallery Desk! Message ID: ${galleryData.id}`);
    }

    return { success: true };
  } catch (err) {
    console.error("[EmailService] Exhibition RSVP email delivery notice:", err.message);
    return { success: false, error: err.message };
  }
}

function buildCollectorBidEmailHtml(bid) {
  const formattedBid = `₹ ${Number(bid.bidAmount).toLocaleString("en-IN")}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Primo Art Gallery — Auction Bid Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #17202A; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 20px auto; background: #FFFFFF; border: 2px solid #D4AF37; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background-color: #17202A; padding: 30px; text-align: center; border-bottom: 2px solid #D4AF37; }
    .brand-eyebrow { color: #D4AF37; font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 6px; }
    .brand-title { color: #FFFFFF; font-size: 22px; font-weight: 700; margin: 0; }
    .body { padding: 32px; }
    .bid-card { background-color: #FAF8F5; border: 1.5px solid #E8E2D8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .bid-label { font-size: 10px; font-weight: 800; color: #8A857C; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .bid-amount { font-family: -apple-system, sans-serif; font-size: 32px; font-weight: 800; color: #9A7B38; margin: 4px 0 8px 0; }
    .bid-ref { font-family: monospace; font-size: 13px; font-weight: 700; color: #555; letter-spacing: 1px; }
    .field-row { display: flex; justify-content: space-between; border-bottom: 1px solid #F0ECE4; padding: 10px 0; font-size: 14px; }
    .field-name { color: #8A857C; font-weight: 600; }
    .field-val { color: #17202A; font-weight: 700; text-align: right; }
    .notice { background-color: #FAF8F5; border-left: 3px solid #D4AF37; padding: 14px; border-radius: 6px; font-size: 12.5px; color: #555; margin-top: 20px; line-height: 18px; }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #8A857C; border-top: 1px solid #E8E2D8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">LIVE AUCTION DESK</div>
      <h1 class="brand-title">Official Bid Confirmation</h1>
    </div>
    <div class="body">
      <div class="bid-card">
        <div class="bid-label">CONFIRMED BID AMOUNT</div>
        <div class="bid-amount">${formattedBid}</div>
        <div class="bid-ref">REFERENCE: ${bid.bidReference}</div>
      </div>

      <div class="field-row">
        <span class="field-name">Artwork Lot</span>
        <span class="field-val">${bid.lotTitle}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Master Artist</span>
        <span class="field-val">${bid.artist}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Lot Identifier</span>
        <span class="field-val">LOT #${bid.lotId}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Bidder Name</span>
        <span class="field-val">${bid.collectorName}</span>
      </div>
      <div class="field-row">
        <span class="field-name">Bid Status</span>
        <span class="field-val" style="color: #27AE60;">Active &bull; Validated</span>
      </div>

      <div class="notice">
        <strong>Auction Policy Notice:</strong> Your bid is binding according to Primo Art Gallery live auction rules. In the event you are outbid or successful at auction close, our senior curatorial desk will notify you immediately.
      </div>
    </div>
    <div class="footer">
      Primo Art Gallery &bull; Live Auction Curatorial Board &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

function buildGalleryBidNotificationEmailHtml(bid) {
  const formattedBid = `₹ ${Number(bid.bidAmount).toLocaleString("en-IN")}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Primo Art Gallery — New VIP Auction Bid Placed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #17202A; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 20px auto; background: #FFFFFF; border: 1px solid #E8E2D8; border-radius: 16px; overflow: hidden; }
    .header { background-color: #17202A; padding: 24px; text-align: center; }
    .brand-eyebrow { color: #D4AF37; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .brand-title { color: #FFFFFF; font-size: 20px; font-weight: 700; margin: 0; }
    .body { padding: 28px; }
    .field-label { font-size: 11px; font-weight: 700; color: #8A857C; text-transform: uppercase; margin-top: 14px; margin-bottom: 2px; }
    .field-val { font-size: 15px; color: #17202A; font-weight: 500; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #8A857C; border-top: 1px solid #E8E2D8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-eyebrow">Curatorial Auction Desk</div>
      <h1 class="brand-title">New In-App VIP Auction Bid</h1>
    </div>
    <div class="body">
      <div class="field-label">Artwork Lot</div>
      <div class="field-val"><strong>${bid.lotTitle}</strong> (LOT #${bid.lotId})</div>

      <div class="field-label">Artist</div>
      <div class="field-val">${bid.artist}</div>

      <div class="field-label">Bid Amount</div>
      <div class="field-val" style="font-size: 22px; font-weight: 800; color: #9A7B38;">${formattedBid}</div>

      <div class="field-label">Bid Reference</div>
      <div class="field-val" style="font-family: monospace; font-weight: 700;">${bid.bidReference}</div>

      <div class="field-label">Collector Name</div>
      <div class="field-val">${bid.collectorName} ${bid.collectorUid ? '<span style="color:#D4AF37; font-size:12px;">(Verified Member)</span>' : ''}</div>

      <div class="field-label">Collector Email</div>
      <div class="field-val"><a href="mailto:${bid.collectorEmail}">${bid.collectorEmail}</a></div>

      ${bid.collectorPhone ? `
      <div class="field-label">Telephone / WhatsApp</div>
      <div class="field-val"><a href="tel:${bid.collectorPhone}">${bid.collectorPhone}</a></div>
      ` : ''}
    </div>
    <div class="footer">
      Primo Art Gallery &bull; New Delhi, India
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Dispatches auction bid confirmation email to bidder and high-priority notification to gallery desk.
 */
async function sendAuctionBidEmails(bid) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Primo Art Gallery <onboarding@resend.dev>";
  const galleryEmail = process.env.GALLERY_CONTACT_EMAIL || "contact@primoartgallery.com";

  if (!apiKey || apiKey.trim() === "") {
    console.log(`[EmailService] ------------------------------------------------------------`);
    console.log(`[EmailService] 🔨 DEV MODE AUCTION BID DISPATCH`);
    console.log(`[EmailService]     To Collector  : ${bid.collectorName} <${bid.collectorEmail}>`);
    console.log(`[EmailService]     Lot Title     : ${bid.lotTitle} (LOT #${bid.lotId})`);
    console.log(`[EmailService]     Bid Amount    : ₹ ${Number(bid.bidAmount).toLocaleString("en-IN")}`);
    console.log(`[EmailService]     Bid Reference : ${bid.bidReference}`);
    console.log(`[EmailService]     To Gallery    : ${galleryEmail}`);
    console.log(`[EmailService] ------------------------------------------------------------`);
    return { success: true, mode: "local_dev" };
  }

  try {
    // 1. Send confirmation to Bidder
    const collectorRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [bid.collectorEmail],
        subject: `🔨 Bid Confirmed: ₹ ${Number(bid.bidAmount).toLocaleString("en-IN")} on ${bid.lotTitle} — Primo Art Gallery`,
        html: buildCollectorBidEmailHtml(bid),
        text: `Your bid of ₹ ${Number(bid.bidAmount).toLocaleString("en-IN")} on "${bid.lotTitle}" (LOT #${bid.lotId}) is confirmed.\n\nBid Reference: ${bid.bidReference}\nStatus: Active & Validated\n\nThank you for participating in Primo Art Gallery Live Auctions.`,
      }),
    });

    if (collectorRes.ok) {
      const collectorData = await collectorRes.json();
      console.log(`[EmailService] ✨ Bid Confirmation Email Delivered to Collector! Message ID: ${collectorData.id}`);
    }

    // 2. Send high-priority notification to Gallery Auction Desk
    const galleryRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [galleryEmail],
        reply_to: bid.collectorEmail,
        subject: `[Auction Bid] ₹ ${Number(bid.bidAmount).toLocaleString("en-IN")} on ${bid.lotTitle} — ${bid.collectorName}`,
        html: buildGalleryBidNotificationEmailHtml(bid),
        text: `New VIP Bid Placed\nLot: ${bid.lotTitle} (LOT #${bid.lotId})\nAmount: ₹ ${Number(bid.bidAmount).toLocaleString("en-IN")}\nBidder: ${bid.collectorName} (${bid.collectorEmail})\nReference: ${bid.bidReference}`,
      }),
    });

    if (galleryRes.ok) {
      const galleryData = await galleryRes.json();
      console.log(`[EmailService] ✨ Auction Bid Notification Delivered to Gallery Desk! Message ID: ${galleryData.id}`);
    }

    return { success: true };
  } catch (err) {
    console.error("[EmailService] Auction bid email delivery notice:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmail,
  buildLuxuryOtpEmailHtml,
  sendArtworkEnquiryEmail,
  buildArtworkEnquiryEmailHtml,
  sendExhibitionRsvpEmails,
  buildCollectorVipPassEmailHtml,
  buildGalleryRsvpNotificationEmailHtml,
  sendAuctionBidEmails,
  buildCollectorBidEmailHtml,
  buildGalleryBidNotificationEmailHtml,
};
