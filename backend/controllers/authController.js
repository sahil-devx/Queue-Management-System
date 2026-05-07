const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const User = require('../models/User');

function normalizeAdminEmail(value) {
  if (value == null || value === '') return '';
  return String(value).trim().replace(/\r$/, '').toLowerCase();
}
                                                        //Otpgen   login  registration  Token
function signToken(user) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('Missing required env var: JWT_SECRET');

  const payload = {
    sub: user._id.toString(),
    role: user.role
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpExpiryDate() {
  const minutes = Math.max(Number(process.env.OTP_EXPIRY_MINUTES || 10), 1);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function sendOtpEmail(targetEmail, otp, name) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
    throw new Error('Email service is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.');
  }

  console.log(`Attempting to send email to: ${targetEmail}`);
  console.log(`SMTP Host: ${smtpHost}`);
  console.log(`SMTP Port: ${smtpPort}`);
  console.log(`SMTP User: ${smtpUser}`);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    debug: true,
    logger: true
  });

  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to: targetEmail,
      subject: 'Queue System Password Reset OTP',
      text: `Hello ${name || 'User'},\n\nYour Queue System password reset OTP is: ${otp}\nThis OTP will expire in ${Math.max(Number(process.env.OTP_EXPIRY_MINUTES || 10), 1)} minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Hello ${name || 'User'},</p>
        <p>Your Queue System password reset OTP is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${otp}</p>
        <p>This OTP will expire in ${Math.max(Number(process.env.OTP_EXPIRY_MINUTES || 10), 1)} minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>`
    });
    
    console.log('Email sent successfully:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(String(password), saltRounds);

    const requestedRole = String(role || '').trim().toLowerCase();
    const envAdminEmail = normalizeAdminEmail(process.env.INITIAL_ADMIN_EMAIL);
    const isInitialAdminEmail = envAdminEmail && normalizedEmail === envAdminEmail;
    const assignedRole = requestedRole === 'admin' || isInitialAdminEmail ? 'admin' : 'user';

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: assignedRole,
      profilePicture: '/uploads/default-avatar.svg'
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '/uploads/default-avatar.svg'
      }
    });
  } catch (err) {
    // Handle duplicate key at the DB level just in case of race conditions
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '/uploads/default-avatar.svg'
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const removeProfilePicture = String(req.body?.removeProfilePicture || '').toLowerCase() === 'true';

    if (name) user.name = name;
    user.phone = phone;
    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Valid email is required' });
      }
      const existing = await User.findOne({ email, _id: { $ne: user._id } }).select('_id');
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    if (removeProfilePicture) {
      user.profilePicture = '/uploads/default-avatar.svg';
    } else if (req.file) {
      user.profilePicture = `/uploads/${req.file.filename}`;
    }

    await user.save();
    return res.json({
      message: 'Profile updated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '/uploads/default-avatar.svg'
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const [users, total] = await Promise.all([
      User.find({})
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      User.countDocuments()
    ]);

    return res.json({ users, total, limit, offset });
  } catch (err) {
    return next(err);
  }
}

async function sendForgotPasswordOtp(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    // Prevent account enumeration by returning generic success.
    if (!user) return res.json({ message: 'If this email is registered, an OTP has been sent.' });

    const otp = generateSixDigitOtp();
    user.passwordResetOtpHash = hashOtp(otp);
    user.passwordResetOtpExpiresAt = getOtpExpiryDate();
    user.passwordResetOtpVerified = false;
    await user.save();

    try {
      await sendOtpEmail(user.email, otp, user.name);
      return res.json({ message: 'If this email is registered, an OTP has been sent.' });
    } catch (mailErr) {
      console.error('Email sending error:', mailErr);
      return res.status(503).json({ message: 'Email service is temporarily unavailable. Please try again later.' });
    }
  } catch (err) {
    return next(err);
  }
}

async function verifyForgotPasswordOtp(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'OTP must be 6 digits' });

    const user = await User.findOne({ email });
    if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (user.passwordResetOtpHash !== hashOtp(otp)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.passwordResetOtpVerified = true;
    await user.save();
    return res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    return next(err);
  }
}

async function resetForgotPassword(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || '');
    if (!email || !newPassword) return res.status(400).json({ message: 'Email and newPassword are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ email });
    if (!user || !user.passwordResetOtpVerified || !user.passwordResetOtpExpiresAt) {
      return res.status(400).json({ message: 'OTP verification required before password reset' });
    }
    if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.passwordResetOtpHash = '';
    user.passwordResetOtpExpiresAt = null;
    user.passwordResetOtpVerified = false;
    await user.save();

    return res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (err) {
    return next(err);
  }
}

async function sendRegisterOtp(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Generate OTP and store it temporarily
    const otp = generateSixDigitOtp();
    const otpData = {
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: String(role || '').trim().toLowerCase(),
      otpHash: hashOtp(otp),
      otpExpiresAt: getOtpExpiryDate()
    };

    // Store OTP data temporarily (you could use Redis or a temporary collection)
    // For now, we'll use a simple in-memory store with expiration
    if (!global.registerOtps) {
      global.registerOtps = new Map();
    }
    global.registerOtps.set(normalizedEmail, otpData);

    try {
      await sendOtpEmail(normalizedEmail, otp, name);
      return res.json({ message: 'OTP sent to your email.' });
    } catch (mailErr) {
      console.error('Email sending error:', mailErr);
      return res.status(503).json({ message: 'Email service is temporarily unavailable. Please try again later.' });
    }
  } catch (err) {
    return next(err);
  }
}

async function verifyRegisterOtp(req, res, next) {
  try {
    const { email, otp } = req.body || {};
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'OTP must be 6 digits' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    
    // Get stored OTP data
    const otpData = global.registerOtps?.get(normalizedEmail);
    if (!otpData) {
      return res.status(400).json({ message: 'OTP not found or expired. Please try again.' });
    }

    // Check OTP expiry
    if (otpData.otpExpiresAt.getTime() < Date.now()) {
      global.registerOtps.delete(normalizedEmail);
      return res.status(400).json({ message: 'OTP has expired. Please try again.' });
    }

    // Verify OTP
    if (otpData.otpHash !== hashOtp(otp)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid, return success
    return res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    return next(err);
  }
}

async function completeRegister(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists (double check)
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(String(password), saltRounds);

    const requestedRole = String(role || '').trim().toLowerCase();
    const envAdminEmail = normalizeAdminEmail(process.env.INITIAL_ADMIN_EMAIL);
    const isInitialAdminEmail = envAdminEmail && normalizedEmail === envAdminEmail;
    const assignedRole = requestedRole === 'admin' || isInitialAdminEmail ? 'admin' : 'user';

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: assignedRole,
      profilePicture: '/uploads/default-avatar.svg'
    });

    // Clean up OTP data
    global.registerOtps?.delete(normalizedEmail);

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '/uploads/default-avatar.svg'
      }
    });
  } catch (err) {
    // Handle duplicate key at the DB level just in case of race conditions
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    return next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  listUsers,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
  sendRegisterOtp,
  verifyRegisterOtp,
  completeRegister
};

