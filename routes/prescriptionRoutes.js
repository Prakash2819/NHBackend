const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');

// Helper
const toId = (id) => new mongoose.Types.ObjectId(id);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/prescriptions/doctor/:doctorId — all prescriptions written by doctor
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const rxs = await Prescription.find({ doctorId: toId(req.params.doctorId) })
      .sort({ createdAt: -1 });
    res.json(rxs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prescriptions — write a new prescription (doctor)
router.post('/', async (req, res) => {
  try {
    const {
      doctorId, doctorName, doctorSpecialty,
      patientId, patientName, patientAge,
      diagnosis, medications, notes, pharmacy,
    } = req.body;

    const rx = new Prescription({
      doctorId: toId(doctorId),
      doctorName, doctorSpecialty,
      patientId: toId(patientId),
      patientName, patientAge,
      diagnosis, medications, notes, pharmacy,
    });
    await rx.save();
    res.status(201).json(rx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/prescriptions/:id — update prescription
router.put('/:id', async (req, res) => {
  try {
    const rx = await Prescription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rx) return res.status(404).json({ error: 'Prescription not found' });
    res.json(rx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/prescriptions/:id
router.delete('/:id', async (req, res) => {
  try {
    await Prescription.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/prescriptions/:id/expire — mark as expired
router.put('/:id/expire', async (req, res) => {
  try {
    const rx = await Prescription.findByIdAndUpdate(req.params.id, { status: 'expired' }, { new: true });
    res.json(rx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/prescriptions/patient/:patientId — all prescriptions for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const rxs = await Prescription.find({ patientId: toId(req.params.patientId) })
      .sort({ createdAt: -1 });
    res.json(rxs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;