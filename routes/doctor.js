const express = require('express');
const router  = express.Router();
const Doctor  = require('../models/Doctor');
const bcrypt = require('bcryptjs');

// Shape DB doc → frontend format
function shape(doc) {
  return {
    personal: {
      name:     doc.name,
      email:    doc.email,
      phone:    doc.phone     || '',
      dob:      doc.dob       || '',
      gender:   doc.gender    || '',
      initials: doc.initials  || doc.name.split(' ').map(n => n[0]).join('').toUpperCase(),
      photo:    doc.photo     || null,
    },
    professional: {
      specialty:      doc.specialization || '',
      subSpecialty:   doc.subSpecialty   || '',
      experience:     doc.experience     || '',
      degree:         doc.degree         || '',
      registrationNo: doc.registrationNo || '',
      hospital:       doc.hospital       || '',
      department:     doc.department     || '',
      languages:      doc.languages      || [],
    },
    clinic: {
      name:     doc.clinic?.name     || '',
      address:  doc.clinic?.address  || '',
      city:     doc.clinic?.city     || '',
      state:    doc.clinic?.state    || '',
      pincode:  doc.clinic?.pincode  || '',
      phone:    doc.clinic?.phone    || '',
      fee:      doc.clinic?.fee      || '',
      videoFee: doc.clinic?.videoFee || '',
    },
    bank: {
      accountName:   doc.bank?.accountName   || '',
      accountNumber: doc.bank?.accountNumber || '',
      ifsc:          doc.bank?.ifsc          || '',
      bankName:      doc.bank?.bankName      || '',
      branch:        doc.bank?.branch        || '',
    },
  };
}

// GET /api/doctor/profile/:doctorId
router.get('/profile/:doctorId', async (req, res) => {
  try {
    const doc = await Doctor.findById(req.params.doctorId).select('-password');
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json(shape(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/doctor/profile/:doctorId/personal
router.put('/profile/:doctorId/personal', async (req, res) => {
  try {
    const { name, email, phone, dob, gender } = req.body;
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { name, email, phone, dob, gender } },
      { new: true }
    ).select('-password');
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/doctor/profile/:doctorId/professional
router.put('/profile/:doctorId/professional', async (req, res) => {
  try {
    const { specialty, subSpecialty, experience, degree, registrationNo, hospital, department, languages } = req.body;
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { specialization: specialty, subSpecialty, experience, degree, registrationNo, hospital, department, languages } },
      { new: true }
    ).select('-password');
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/doctor/profile/:doctorId/clinic
router.put('/profile/:doctorId/clinic', async (req, res) => {
  try {
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { clinic: req.body } },
      { new: true }
    ).select('-password');
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/doctor/profile/:doctorId/bank
router.put('/profile/:doctorId/bank', async (req, res) => {
  try {
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { bank: req.body } },
      { new: true }
    ).select('-password');
    res.json(shape(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/doctor/profile/:doctorId/photo
router.put('/profile/:doctorId/photo', async (req, res) => {
  try {
    const { photo } = req.body;
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { photo } },
      { new: true }
    ).select('-password');
    res.json({ photo: doc.photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Change Password
router.put('/profile/:doctorId/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const doctor = await Doctor.findById(req.params.doctorId);
    const match  = await bcrypt.compare(currentPassword, doctor.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await Doctor.findByIdAndUpdate(req.params.doctorId, { $set: { password: hashed } });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET schedule
router.get('/schedule/:doctorId', async (req, res) => {
  try {
    const doc = await Doctor.findById(req.params.doctorId).select('schedule slotDuration leaves');
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json({
      schedule:     doc.schedule     || {},
      slotDuration: doc.slotDuration || 30,
      leaves:       doc.leaves       || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT save schedule + slotDuration
router.put('/schedule/:doctorId', async (req, res) => {
  try {
    const { schedule, slotDuration } = req.body;
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { schedule, slotDuration } },
      { new: true }
    ).select('schedule slotDuration leaves');
    res.json({ schedule: doc.schedule, slotDuration: doc.slotDuration, leaves: doc.leaves });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST add leave
router.post('/schedule/:doctorId/leave', async (req, res) => {
  try {
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $push: { leaves: req.body } },
      { new: true }
    ).select('schedule slotDuration leaves');
    res.json({ leaves: doc.leaves });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE leave
router.delete('/schedule/:doctorId/leave/:leaveId', async (req, res) => {
  try {
    const doc = await Doctor.findByIdAndUpdate(
      req.params.doctorId,
      { $pull: { leaves: { _id: req.params.leaveId } } },
      { new: true }
    ).select('schedule slotDuration leaves');
    res.json({ leaves: doc.leaves });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/doctors  ← add this (used by patient dashboard)
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.find({ status: 'approved' })
      .select('name specialization photo hospital experience clinic');
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;