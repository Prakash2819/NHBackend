const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({

  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor',  required: true },

  // Snapshot of doctor info at booking time
  doctorName:     { type: String, default: '' },
  doctorSpecialty:{ type: String, default: '' },
  doctorPhoto:    { type: String, default: null },
  doctorFee:      { type: String, default: '' },
  doctorHospital: { type: String, default: '' },

  // Snapshot of patient info at booking time
  patientName:  { type: String, default: '' },
  patientPhone: { type: String, default: '' },
  patientAge:   { type: String, default: '' },

  date:    { type: String, required: true }, // "2026-03-10"
  time:    { type: String, default: '' },    // "10:30 AM"
  type:    { type: String, enum: ['video', 'in-person'], default: 'in-person' },
  reason:  { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'missed'],
    default: 'pending',
  },

  // Set when patient reschedules — links back to original
  rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

  notes: { type: String, default: '' }, // doctor can add notes after

  // ── Delay tracking ──────────────────────────────────────────────────────
  delayMinutes:   { type: Number, default: 0 },      // total delay added so far
  delayReason:    { type: String, default: '' },      // e.g. 'Previous patient took longer'
  delayNotifiedAt:{ type: Date,   default: null },    // last time patients were SMSed
  isRunningLate:  { type: Boolean, default: false },  // flag shown in patient UI

  // Patient review after completed appointment
  rating: { type: Number, min: 1, max: 5, default: null },
  review: { type: String, default: '' },

}, { timestamps: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);
module.exports = Appointment;