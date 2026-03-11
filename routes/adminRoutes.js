const express     = require('express');
const router      = express.Router();
const Doctor      = require('../models/Doctor');
const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalDoctors, totalPatients, totalAppointments,
           pendingDoctors, todayAppointments] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      Appointment.countDocuments(),
      Doctor.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ date: new Date().toISOString().split('T')[0] }),
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
    const { status } = req.body; // 'pending' | 'approved' | 'rejected'
    const doc = await Doctor.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
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
// Update a doctor's full schedule from admin panel
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