const express = require('express');
const router  = express.Router();
const Patient = require('../models/Patient');

// ── POST /api/mobile-login ────────────────────────────────────────────────────
// Called after Firebase OTP verification
router.post('/mobile-login', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    // Find existing patient or create new one
    let patient = await Patient.findOne({ phone });

    if (!patient) {
      // First time login → create patient document
      patient = await Patient.create({
        phone,
        role:        'patient',
        isOnboarded: false,
      });
    }

    res.json({
      user: {
        _id:         patient._id,
        role:        patient.role,
        isOnboarded: patient.isOnboarded, // ← frontend uses this to show onboarding popup
        name:        patient.name || '',
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;