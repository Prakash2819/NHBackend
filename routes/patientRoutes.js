const express = require('express');
const router  = express.Router();
const Patient = require('../models/Patient');

// ── Shape: DB doc → frontend format ──────────────────────────────────────────
function shape(doc) {
  return {
    _id:         doc._id,
    isOnboarded: doc.isOnboarded,
    personal: {
      name:        doc.name        || '',
      email:       doc.email       || '',
      phone:       doc.phone       || '',
      dob:         doc.dob         || '',
      gender:      doc.gender      || '',
      photo:       doc.photo       || null,
      bloodGroup:  doc.bloodGroup  || '',
      height:      doc.height      || '',
      weight:      doc.weight      || '',
    },
    medical: {
      allergies:  doc.allergies  || [],
      conditions: doc.conditions || [],
    },
    address: {
      line1:   doc.address?.line1   || '',
      city:    doc.address?.city    || '',
      state:   doc.address?.state   || '',
      pincode: doc.address?.pincode || '',
    },
    emergency: {
      name:         doc.emergency?.name         || '',
      relationship: doc.emergency?.relationship || '',
      phone:        doc.emergency?.phone        || '',
    },
  };
}

// GET /api/patient/profile/:patientId
router.get('/profile/:patientId', async (req, res) => {
  try {
    const doc = await Patient.findById(req.params.patientId);
    if (!doc) return res.status(404).json({ error: 'Patient not found' });
    res.json(shape(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patient/onboard/:patientId  ← called from the popup
router.post('/onboard/:patientId', async (req, res) => {
  try {
    const { name, email, dob, gender } = req.body;
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { name, email, dob, gender, isOnboarded: true } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Patient not found' });
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/patient/profile/:patientId/personal
router.put('/profile/:patientId/personal', async (req, res) => {
  try {
    const { name, email, dob, gender, bloodGroup, height, weight } = req.body;
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { name, email, dob, gender, bloodGroup, height, weight } },
      { new: true }
    );
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/patient/profile/:patientId/address
router.put('/profile/:patientId/address', async (req, res) => {
  try {
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { address: req.body } },
      { new: true }
    );
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/patient/profile/:patientId/emergency
router.put('/profile/:patientId/emergency', async (req, res) => {
  try {
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { emergency: req.body } },
      { new: true }
    );
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/patient/profile/:patientId/medical
router.put('/profile/:patientId/medical', async (req, res) => {
  try {
    const { allergies, conditions } = req.body;
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { allergies, conditions } },
      { new: true }
    );
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/patient/profile/:patientId/photo
router.put('/profile/:patientId/photo', async (req, res) => {
  try {
    const { photo } = req.body;
    const doc = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: { photo } },
      { new: true }
    );
    res.json({ photo: doc.photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;