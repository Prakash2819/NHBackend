const express     = require('express');
const router      = express.Router();
const crypto      = require('crypto');
const Doctor      = require('../models/Doctor');
const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');

// ── Config ────────────────────────────────────────────────────────────────────
// Set ADMIN_PASSWORD in your .env file. Default is only for dev.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin@123';
const TOKEN_SECRET   = process.env.ADMIN_TOKEN_SECRET || 'healthapp_admin_secret_key_2024';
const TOKEN_TTL_MS   = 8 * 60 * 60 * 1000; // 8 hours

// ── Token helpers (no external deps — uses Node built-in crypto) ──────────────
function signToken(payload) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() > payload.exp) return null; // expired
    return payload;
  } catch { return null; }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  req.admin = payload;
  next();
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = signToken({ role: 'admin', exp: Date.now() + TOKEN_TTL_MS });
  res.json({ token, expiresIn: TOKEN_TTL_MS });
});

// ── POST /api/admin/verify ────────────────────────────────────────────────────
// Frontend calls this on page load to check if stored token is still valid
router.post('/verify', (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ valid: false });
  const payload = verifyToken(token);
  res.json({ valid: !!payload });
});

// ── All routes below require auth ─────────────────────────────────────────────
router.use(requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [totalDoctors, totalPatients, totalAppointments, pendingDoctors, todayAppointments] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      Appointment.countDocuments(),
      Doctor.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ date: today }),
    ]);
    res.json({ totalDoctors, totalPatients, totalAppointments, pendingDoctors, todayAppointments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/doctors ────────────────────────────────────────────────────
router.get('/doctors', async (req, res) => {
  try {
    const docs = await Doctor.find().select('-password').sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/admin/doctors/:id/status ─────────────────────────────────────────
router.put('/doctors/:id/status', async (req, res) => {
  try {
    const { status, regVerified } = req.body;
    const update = { status };
    if (regVerified !== undefined) update.regVerified = regVerified;
    const doc = await Doctor.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/admin/doctors/:id ─────────────────────────────────────────────
router.delete('/doctors/:id', async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/patients ───────────────────────────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/admin/patients/:id ───────────────────────────────────────────
router.delete('/patients/:id', async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/appointments ───────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const appts = await Appointment.find().sort({ date: -1, time: -1 }).limit(200);
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/admin/appointments/:id ────────────────────────────────────────
router.delete('/appointments/:id', async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/admin/doctors/:id/schedule ──────────────────────────────────────
router.put('/doctors/:id/schedule', async (req, res) => {
  try {
    const { schedule, slotDuration } = req.body;
    const doc = await Doctor.findByIdAndUpdate(
      req.params.id,
      { $set: { schedule, slotDuration } },
      { new: true }
    ).select('-password');
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;