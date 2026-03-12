const { default: mongoose } = require('mongoose');

// ── Reusable day sub-schema ───────────────────────────────────────────────────
// Defined separately so Mongoose correctly interprets Boolean and nested types
const daySchema = new mongoose.Schema({
  open:  { type: Boolean, default: false },
  slots: [{ start: { type: String }, end: { type: String } }],
}, { _id: false });  // _id: false — no extra _id per day entry

// ── Leave sub-schema ──────────────────────────────────────────────────────────
const leaveSchema = new mongoose.Schema({
  from:   { type: String },
  to:     { type: String },
  reason: { type: String },
  type:   { type: String, enum: ['personal', 'medical', 'conference', 'vacation', 'other'] },
}, { _id: true });

// ── Main Doctor Schema ────────────────────────────────────────────────────────
const doctorSchema = new mongoose.Schema({

  // ── Auth fields (unchanged) ──
  name:           { type: String, required: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  password:       { type: String, required: true },
  specialization: { type: String, required: true },
  role:           { type: String, default: 'doctor' },
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  // ── Personal ──
  phone:    { type: String, default: '' },
  dob:      { type: String, default: '' },
  gender:   { type: String, default: '' },
  initials: { type: String, default: '' },
  photo:    { type: String, default: null },

  // ── Professional ──
  subSpecialty:   { type: String, default: '' },
  experience:     { type: String, default: '' },
  degree:         { type: String, default: '' },
  registrationNo: { type: String, default: '' },
  regVerified:    { type: Boolean, default: false },
  hospital:       { type: String, default: '' },
  department:     { type: String, default: '' },
  languages:      [{ type: String }],

  // ── Clinic ──
  clinic: {
    name:     { type: String, default: '' },
    address:  { type: String, default: '' },
    city:     { type: String, default: '' },
    state:    { type: String, default: '' },
    pincode:  { type: String, default: '' },
    phone:    { type: String, default: '' },
    fee:      { type: String, default: '' },
    videoFee: { type: String, default: '' },
  },

  // ── Bank ──
  bank: {
    accountName:   { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc:          { type: String, default: '' },
    bankName:      { type: String, default: '' },
    branch:        { type: String, default: '' },
  },

  // ── Schedule (each day uses daySchema so Boolean is parsed correctly) ──
  schedule: {
    Monday:    { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Tuesday:   { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Wednesday: { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Thursday:  { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Friday:    { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Saturday:  { type: daySchema, default: () => ({ open: false, slots: [] }) },
    Sunday:    { type: daySchema, default: () => ({ open: false, slots: [] }) },
  },

  slotDuration: { type: Number, default: 30 },

  leaves: [leaveSchema],

}, { timestamps: true });

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;