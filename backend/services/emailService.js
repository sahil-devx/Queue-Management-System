const nodemailer = require('nodemailer');

let transporter = null;

// Create transporter lazily using existing SMTP configuration
function getTransporter() {
  if (!transporter) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      console.log('Email service not configured, emails will not be sent');
      return null;
    }
    
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      debug: true,
      logger: true
    });
  }
  return transporter;
}

async function sendCallNotification(userEmail, userName, queueTitle, adminName, adminEmail) {
  try {
    const emailTransporter = getTransporter();
    if (!emailTransporter) {
      console.log('Email service not configured, skipping email notification');
      return false;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM || smtpUser;

    const mailOptions = {
      from: fromEmail,
      to: userEmail,
      subject: `You're Being Called - ${queueTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">You're Being Called! </h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Please proceed to the queue</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Queue Details</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Queue:</strong> ${queueTitle}</p>
              <p style="margin: 5px 0;"><strong>Called by:</strong> ${adminName}</p>
              <p style="margin: 5px 0;"><strong>Contact Admin:</strong> <a href="mailto:${adminEmail}" style="color: #667eea;">${adminEmail}</a></p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; background: #fff3cd; border-radius: 10px; border: 1px solid #ffeaa7;">
            <p style="margin: 0; color: #856404; font-weight: bold;">Please proceed to the service counter immediately</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            <p>This is an automated notification from the Queue Management System</p>
          </div>
        </div>
      `
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

module.exports = {
  sendCallNotification
};
