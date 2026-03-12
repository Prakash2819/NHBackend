const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  dose:         { type: String, required: true },
  frequency:    { type: String, default: 'Once daily' },
  duration:     { type: String, default: '1 month' },
  timing:       { type: String, default: 'Morning' },
  instructions: { type: String, default: '' },
  // patient-facing stock tracking (optional)
  refillsLeft:  { type: Number, default: 0 },
  totalRefills: { type: Number, default: 0 },
  stock:        { type: Number, default: 0 },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  rxNumber:   { type: String, unique: true },   // auto-generated
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  doctorName: { type: String, default: '' },
  doctorSpecialty: { type: String, default: '' },
  patientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  patientName:{ type: String, default: '' },
  patientAge: { type: Number, default: 0 },
  diagnosis:  { type: String, required: true },
  medications:{ type: [medicationSchema], default: [] },
  notes:      { type: String, default: '' },
  status:     { type: String, enum: ['active', 'expired'], default: 'active' },
  issuedDate: { type: String },   // YYYY-MM-DD
  expiryDate: { type: String },   // YYYY-MM-DD (issuedDate + 6 months default)
  pharmacy:   { type: String, default: '' },
}, { timestamps: true });

// Auto-generate rxNumber before save
prescriptionSchema.pre('save', async function (next) {
  if (!this.rxNumber) {
    const year  = new Date().getFullYear();
    const count = await mongoose.model('Prescription').countDocuments();
    this.rxNumber = `RX-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  if (!this.issuedDate) {
    this.issuedDate = new Date().toISOString().split('T')[0];
  }
  if (!this.expiryDate) {
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 6);
    this.expiryDate = exp.toISOString().split('T')[0];
  }
  next();
});

module.exports = mongoose.model('Prescription', prescriptionSchema);