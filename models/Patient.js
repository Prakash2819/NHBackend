const { default: mongoose } = require('mongoose')
const patientSchema = new mongoose.Schema({

  // ── Auth (already exists in your user routes) ──
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    default: 'patient',
  },

  // ── Basic info (collected in onboarding popup) ──
  name:   { type: String, default: '' },
  email:  { type: String, default: '' },
  dob:    { type: String, default: '' },
  gender: { type: String, default: '' },
  photo:  { type: String, default: null },

  // ── Profile (editable later) ──
  bloodGroup:  { type: String, default: '' },
  height:      { type: String, default: '' },
  weight:      { type: String, default: '' },
  allergies:   [{ type: String }],
  conditions:  [{ type: String }],  // chronic conditions

  address: {
    line1:   { type: String, default: '' },
    city:    { type: String, default: '' },
    state:   { type: String, default: '' },
    pincode: { type: String, default: '' },
  },

  emergency: {
    name:         { type: String, default: '' },
    relationship: { type: String, default: '' },
    phone:        { type: String, default: '' },
  },

  // ── Flags ──
  isOnboarded: { type: Boolean, default: false }, // true after popup is filled

}, { timestamps: true });
const Patient = mongoose.model("User", patientSchema);
module.exports = Patient