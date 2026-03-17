const express  = require('express');
const nodemailer = require('nodemailer');
// ── TextBee helper (free, uses your Android phone as SMS gateway) ─────────────
// Setup: textbee.dev → register → install app on Android → get API_KEY + DEVICE_ID
function formatPhoneE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone.replace(/\s/g, '');
  return null;
}

async function sendStatusSMS({ to, patientName, doctorName, specialty, date, time, type, status, delayMinutes = 0, newEstimatedTime = '', reason = '' }) {
  if (!process.env.TEXTBEE_API_KEY || !process.env.TEXTBEE_DEVICE_ID) {
    console.warn('[SMS] TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID not set — skipped');
    return;
  }
  const toE164 = formatPhoneE164(to);
  if (!toE164) { console.warn('[SMS] bad phone:', to); return; }

  const [y, mo, d] = date.split('-').map(Number);
  const dateStr = new Date(y, mo - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const typeStr = type === 'video' ? 'Video Call' : 'In-person Visit';

  let message;
  if (status === 'confirmed') {
    message = `Appt confirmed with Dr ${doctorName} on ${dateStr} at ${time}. Type: ${typeStr}. - Namma Hospitals`;
  } else if (status === 'cancelled') {
    message = `Your appt with Dr ${doctorName} on ${dateStr} at ${time} is CANCELLED. Login to rebook. - Namma Hospitals`;
  } else if (status === 'delayed') {
    const delayText = delayMinutes >= 60
      ? `${Math.floor(delayMinutes/60)}hr${delayMinutes%60>0?' '+delayMinutes%60+'min':''}`.trim()
      : `${delayMinutes}min`;
    message = `Dr ${doctorName} is running ${delayText} late. New time: ${newEstimatedTime}. Sorry for delay. - Namma Hospitals`;
  } else if (status === 'ready-early') {
    message = `Dr ${doctorName} is ready early. Please come in now for your ${dateStr} appt. - Namma Hospitals`;
  } else {
    return;
  }

  // TextBee API — POST to your Android device gateway
  const axios = require('axios');
  const res = await axios.post(
    `https://api.textbee.dev/api/v1/gateway/devices/${process.env.TEXTBEE_DEVICE_ID}/send-sms`,
    {
      recipients: [toE164],
      message,
    },
    {
      headers: {
        'x-api-key':    process.env.TEXTBEE_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );
  console.log('[SMS] TextBee response:', JSON.stringify(res.data));
  return res.data?.data?._id || 'sent';
}





// ── Email transporter (created once, reused) ──────────────────────────────────
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _transporter;
}

// ── Email helper ──────────────────────────────────────────────────────────────
function formatDateReadable(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

async function sendBookingEmail({ to, patientName, doctorName, specialty, hospital, date, time, type, fee }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] EMAIL_USER or EMAIL_PASS not set in environment — skipping');
    return;
  }
  const transporter = getTransporter();

  const typeLabel = type === 'video' ? '🎥 Video Consultation' : '🏥 In-person Visit';
  const feeStr    = fee ? `₹${fee}` : 'As per clinic';
  const dateStr   = formatDateReadable(date);

  await transporter.sendMail({
    from:    `"Namma Hospitals" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Appointment Confirmed — Dr. ${doctorName} on ${dateStr}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:0;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px">
          <h2 style="color:#fff;margin:0;font-size:20px">✅ Appointment Confirmed</h2>
          <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px">Namma Hospitals</p>
        </div>
        <div style="padding:28px 32px">
          <p style="color:#374151;font-size:15px;margin:0 0 20px">Hi <strong>${patientName}</strong>, your appointment has been booked successfully.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280;width:130px">Doctor</td><td style="padding:10px 0;color:#111827;font-weight:600">Dr. ${doctorName}</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280">Specialty</td><td style="padding:10px 0;color:#111827">${specialty}</td></tr>
            ${hospital ? `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280">Hospital</td><td style="padding:10px 0;color:#111827">${hospital}</td></tr>` : ''}
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280">Date</td><td style="padding:10px 0;color:#111827;font-weight:600">${dateStr}</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280">Time</td><td style="padding:10px 0;color:#1d4ed8;font-weight:700">${time}</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 0;color:#6b7280">Type</td><td style="padding:10px 0;color:#111827">${typeLabel}</td></tr>
            <tr><td style="padding:10px 0;color:#6b7280">Fee</td><td style="padding:10px 0;color:#111827">${feeStr}</td></tr>
          </table>
          <div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #2563eb">
            <p style="margin:0;font-size:13px;color:#1d4ed8">
              ${type === 'video'
                ? '📱 <strong>Video call link</strong> will open in your Namma Hospitals app. Please join 5 minutes before your scheduled time.'
                : '📍 Please arrive 10 minutes early at the clinic with a valid ID and any previous medical records.'}
            </p>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">Need to reschedule or cancel? Log in to your account at <a href="https://nhfrontend.netlify.app" style="color:#2563eb">nhfrontend.netlify.app</a></p>
        </div>
        <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© Namma Hospitals — This is an automated confirmation email</p>
        </div>
      </div>
    `,
  });
}

const router   = express.Router();
const Appointment = require('../models/Appointment');
const Doctor   = require('../models/Doctor');
const Patient  = require('../models/Patient');


// ── GET /api/appointments/available-slots ─────────────────────────────────────
// ?doctorId=&date=YYYY-MM-DD
// Returns booked slot times for that doctor+date so frontend can grey them out
router.get('/available-slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date required' });

    const booked = await Appointment.find({
      doctorId,
      date,
      status: { $in: ['pending', 'confirmed'] }, // only active bookings block slots
    }).select('time');

    res.json({ bookedSlots: booked.map(a => a.time) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments/book ───────────────────────────────────────────────
// Called when patient clicks "Confirm Booking"
router.post('/book', async (req, res) => {
  try {
    const { patientId, doctorId, date, time, type, reason } = req.body;

    // ── Slot conflict check: is this slot already booked? ──────────────────
    const slotTaken = await Appointment.findOne({
      doctorId,
      date,
      time,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (slotTaken) {
      return res.status(409).json({ error: 'This slot was just booked by someone else. Please choose another time.' });
    }

    // Fetch doctor + patient for snapshot
    const [doctor, patient] = await Promise.all([
      Doctor.findById(doctorId),
      Patient.findById(patientId),
    ]);

    if (!doctor)  return res.status(404).json({ error: 'Doctor not found' });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Calculate age from DOB
    const age = patient.dob
      ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)).toString()
      : '';

    const appt = await Appointment.create({
      patientId,
      doctorId,
      doctorName:      doctor.name,
      doctorSpecialty: doctor.specialization,
      doctorPhoto:     doctor.photo     || null,
      doctorFee:       doctor.clinic?.fee || '',
      doctorHospital:  doctor.hospital  || '',
      patientName:     patient.name,
      patientPhone:    patient.phone,
      patientAge:      age,
      date,
      time,
      type,
      reason: reason || '',
    });

    // ── Send confirmation email ───────────────────────────────────────────
    const emailTo = patient.email;
    console.log('[Email] patient.email =', emailTo);
    if (emailTo && emailTo.trim()) {
      sendBookingEmail({
        to:           emailTo.trim(),
        patientName:  patient.name  || 'Patient',
        doctorName:   doctor.name   || 'Doctor',
        specialty:    doctor.specialization || '',
        hospital:     doctor.hospital || '',
        date,
        time,
        type,
        fee:          doctor.clinic?.fee || '',
      })
        .then(() => console.log('[Email] ✅ confirmation sent to', emailTo))
        .catch(err => console.error('[Email] ❌ failed:', err.message, '| code:', err.code));
    } else {
      console.log('[Email] skipped — patient has no email on file');
    }
    res.status(201).json(appt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/appointments/patient/:patientId ──────────────────────────────────
// All appointments for a patient (for PatientDashboard)
router.get('/patient/:patientId', async (req, res) => {
  try {
    const appts = await Appointment.find({ patientId: req.params.patientId })
      .sort({ date: -1, createdAt: -1 });
    res.json(appts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/appointments/doctor/:doctorId ────────────────────────────────────
// All appointments for a doctor (for DoctorAppointments page)
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = { doctorId: req.params.doctorId };
    if (status && status !== 'all') filter.status = status;
    if (date) filter.date = date;

    const appts = await Appointment.find(filter).sort({ date: 1, time: 1 });
    res.json(appts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/status ─────────────────────────────────────────
// Doctor updates appointment status (confirm / complete / cancel)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status, ...(notes !== undefined && { notes }) } },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // ── SMS patient on confirm OR cancel ─────────────────────────────────
    if (appt.patientPhone && (status === 'confirmed' || status === 'cancelled')) {
      sendStatusSMS({
        to:          appt.patientPhone,
        patientName: appt.patientName     || 'Patient',
        doctorName:  appt.doctorName      || 'Doctor',
        specialty:   appt.doctorSpecialty || '',
        date:        appt.date,
        time:        appt.time,
        type:        appt.type,
        status,
      })
        .then(sid => console.log(`[SMS] ✅ ${status} SMS sent, SID:`, sid))
        .catch(err => console.error('[SMS] ❌ failed:', err.message));
    }

    res.json(appt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/review ─────────────────────────────────────────
// Patient submits rating + review for completed appointment
router.put('/:id/review', async (req, res) => {
  try {
    const { rating, review } = req.body;
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { rating, review: review || '' } },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/appointments/mark-missed ───────────────────────────────────────
// Call this on app load (or via a cron) to auto-flip past pending/confirmed → missed
// Body: { patientId? } — if provided, only checks that patient's appointments
router.post('/mark-missed', async (req, res) => {
  try {
    const now     = new Date();
    const today   = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Build a filter: pending or confirmed, date < today
    // For today's appointments we also check time has passed
    const filter = {
      status: { $in: ['pending', 'confirmed'] },
    };
    if (req.body.patientId) filter.patientId = req.body.patientId;

    const candidates = await Appointment.find({
      ...filter,
      date: { $lte: today },
    });

    const missedIds = [];
    for (const appt of candidates) {
      // If date is before today → definitely missed
      if (appt.date < today) {
        missedIds.push(appt._id);
        continue;
      }
      // If date is today → check if time has passed (add 30 min grace)
      try {
        const [timePart, ampm] = [appt.time.slice(0, -3), appt.time.slice(-2)];
        let [h, m] = timePart.split(':').map(Number);
        if (ampm?.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
        const apptMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
        if (Date.now() > apptMs + 30 * 60 * 1000) missedIds.push(appt._id);
      } catch { missedIds.push(appt._id); }
    }

    if (missedIds.length > 0) {
      await Appointment.updateMany({ _id: { $in: missedIds } }, { $set: { status: 'missed' } });
    }

    res.json({ marked: missedIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments/:id/reschedule ─────────────────────────────────────
// Creates a NEW appointment as a reschedule of an existing one.
// Marks the original as 'missed' (if not already) and links via rescheduledFrom.
router.post('/:id/reschedule', async (req, res) => {
  try {
    const original = await Appointment.findById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Appointment not found' });

    const { date, time, type } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'date and time are required' });

    // ── Conflict check: new slot must not already be taken ────────────────
    const slotTaken = await Appointment.findOne({
      doctorId: original.doctorId,
      date,
      time,
      status: { $in: ['pending', 'confirmed'] },
      _id: { $ne: original._id }, // exclude the original itself
    });
    if (slotTaken) {
      return res.status(409).json({ error: 'That slot is already booked. Please choose a different time.' });
    }

    // Mark original as missed if it was pending/confirmed
    if (['pending', 'confirmed'].includes(original.status)) {
      await Appointment.findByIdAndUpdate(req.params.id, { $set: { status: 'missed' } });
    }

    // Create the new rescheduled appointment (copy all snapshots)
    const newAppt = await Appointment.create({
      patientId:       original.patientId,
      doctorId:        original.doctorId,
      doctorName:      original.doctorName,
      doctorSpecialty: original.doctorSpecialty,
      doctorPhoto:     original.doctorPhoto,
      doctorFee:       original.doctorFee,
      doctorHospital:  original.doctorHospital,
      patientName:     original.patientName,
      patientPhone:    original.patientPhone,
      patientAge:      original.patientAge,
      date,
      time,
      type:            type || original.type,
      reason:          original.reason,
      rescheduledFrom: original._id,
      status:          'pending',
    });

    res.status(201).json(newAppt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/appointments/ratings/bulk ───────────────────────────────────────
// Returns avg rating + count for ALL doctors in one query (used by doctor cards)
// Optional query: ?ids=id1,id2,id3  to limit to specific doctors
router.get('/ratings/bulk', async (req, res) => {
  try {
    const matchStage = {
      status: 'completed',
      rating: { $ne: null, $exists: true },
    };
    if (req.query.ids) {
      const { Types } = require('mongoose');
      matchStage.doctorId = {
        $in: req.query.ids.split(',').map(id => {
          try { return new Types.ObjectId(id); } catch { return null; }
        }).filter(Boolean),
      };
    }

    const results = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:   '$doctorId',
          avg:   { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Return as a map: { doctorId: { avg, count } }
    const map = {};
    results.forEach(r => {
      map[r._id.toString()] = {
        avg:   Math.round(r.avg * 10) / 10,
        count: r.count,
      };
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/appointments/doctor/:doctorId/reviews ───────────────────────────
// Aggregated ratings + all reviews for a doctor's detail page
router.get('/doctor/:doctorId/reviews', async (req, res) => {
  try {
    const appts = await Appointment.find({
      doctorId: req.params.doctorId,
      status:   'completed',
      rating:   { $ne: null, $exists: true },
    }).select('patientName rating review date').sort({ date: -1 });

    if (appts.length === 0) {
      return res.json({ avg: 0, count: 0, breakdown: {1:0,2:0,3:0,4:0,5:0}, reviews: [] });
    }

    // Calculate average + breakdown
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    appts.forEach(a => {
      const r = Math.round(a.rating);
      if (r >= 1 && r <= 5) { breakdown[r]++; total += a.rating; }
    });
    const avg = Math.round((total / appts.length) * 10) / 10;

    res.json({
      avg,
      count: appts.length,
      breakdown,
      reviews: appts.map(a => ({
        _id:     a._id,
        patient: a.patientName || 'Anonymous',
        rating:  a.rating,
        review:  a.review,
        date:    a.date,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────
// Patient cancels appointment
router.delete('/:id', async (req, res) => {
  try {
    await Appointment.findByIdAndUpdate(req.params.id, { $set: { status: 'cancelled' } });
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/appointments/doctor/:doctorId/patient/:patientId/history ─────────
// Returns all past appointments between this doctor and patient
router.get('/doctor/:doctorId/patient/:patientId/history', async (req, res) => {
  try {
    const appts = await Appointment.find({
      doctorId:  req.params.doctorId,
      patientId: req.params.patientId,
    }).sort({ date: -1 });
    res.json(appts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/appointments/:id/notes ───────────────────────────────────────────
// Doctor saves notes for an appointment (without changing status)
router.put('/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { notes: notes || '' } },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/appointments/doctor/:doctorId/stats ──────────────────────────────
// Dashboard stats: today's appts, weekly counts, monthly count, earnings
router.get('/doctor/:doctorId/stats', async (req, res) => {
  try {
    const { Types } = require('mongoose');
    let doctorId;
    try { doctorId = new Types.ObjectId(req.params.doctorId); }
    catch { return res.status(400).json({ error: 'Invalid doctorId' }); }
    const today = new Date().toISOString().split('T')[0];

    // This week Mon–Sun
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0,0,0,0);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    // This month
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    const [todayAppts, weekAppts, monthAppts, reviewData] = await Promise.all([
      Appointment.find({ doctorId, date: today }).sort({ time: 1 }),
      Appointment.find({ doctorId, date: { $in: weekDates } }),
      Appointment.find({ doctorId, date: { $gte: monthStart }, status: { $in: ['completed','confirmed'] } }),
      Appointment.find({ doctorId, status: 'completed', rating: { $ne: null, $exists: true } }).select('rating'),
    ]);

    // Weekly breakdown by day label
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const weeklyStats = weekDates.map((date, i) => ({
      day:   dayLabels[i],
      count: weekAppts.filter(a => a.date === date).length,
    }));

    // Earnings from completed appointments
    const todayEarnings  = todayAppts.filter(a=>a.status==='completed').reduce((s,a)=>s+(Number(a.doctorFee)||0),0);
    const weekEarnings   = weekAppts.filter(a=>a.status==='completed').reduce((s,a)=>s+(Number(a.doctorFee)||0),0);
    const monthEarnings  = monthAppts.filter(a=>a.status==='completed').reduce((s,a)=>s+(Number(a.doctorFee)||0),0);

    // Rating
    const avgRating = reviewData.length
      ? Math.round(reviewData.reduce((s,a)=>s+a.rating,0) / reviewData.length * 10) / 10
      : 0;

    res.json({
      today: {
        appointments: todayAppts,
        total:     todayAppts.length,
        completed: todayAppts.filter(a=>a.status==='completed').length,
        upcoming:  todayAppts.filter(a=>a.status==='pending'||a.status==='confirmed').length,
        ongoing:   todayAppts.filter(a=>a.status==='confirmed').length,
        earnings:  todayEarnings,
      },
      weekly: {
        stats:    weeklyStats,
        total:    weekAppts.length,
        earnings: weekEarnings,
      },
      monthly: {
        total:    monthAppts.length,
        earnings: monthEarnings,
      },
      rating: { avg: avgRating, count: reviewData.length },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/appointments/doctor/:doctorId/patients/full ──────────────────────
// All patients (no limit) with allergies, conditions, email for MyPatients page
router.get('/doctor/:doctorId/patients/full', async (req, res) => {
  try {
    const { Types } = require('mongoose');
    let oid;
    try { oid = new Types.ObjectId(req.params.doctorId); }
    catch { return res.status(400).json({ error: 'Invalid doctorId' }); }

    const appts = await Appointment.find({ doctorId: oid })
      .sort({ date: -1 })
      .select('patientId patientName date status');

    // Dedupe — count visits per patient
    const seen = new Map();
    appts.forEach(a => {
      const key = String(a.patientId);
      if (!seen.has(key)) {
        seen.set(key, { patientId: a.patientId, patientName: a.patientName, lastVisit: a.date, visits: 0 });
      }
      seen.get(key).visits++;
    });

    const patientIds = [...seen.keys()];
    const patients = await Patient.find({ _id: { $in: patientIds } })
      .select('name email phone gender dob bloodGroup conditions allergies photo');

    const result = patients.map(p => {
      const info = seen.get(String(p._id)) || {};
      const age = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 31557600000) : null;
      return {
        patientId:  p._id,
        name:       p.name  || info.patientName || '',
        email:      p.email || '',
        phone:      p.phone || '',
        gender:     p.gender || '',
        age,
        bloodGroup: p.bloodGroup || '',
        conditions: p.conditions || [],
        allergies:  p.allergies  || [],
        photo:      p.photo      || null,
        lastVisit:  info.lastVisit  || null,
        visits:     info.visits     || 0,
      };
    });

    result.sort((a,b) => (b.lastVisit||'').localeCompare(a.lastVisit||''));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/appointments/doctor/:doctorId/patients ───────────────────────────
// Unique patients who had appointments with this doctor (for recent patients panel)
router.get('/doctor/:doctorId/patients', async (req, res) => {
  try {
    const { Types } = require('mongoose');
    let oid;
    try { oid = new Types.ObjectId(req.params.doctorId); }
    catch { return res.status(400).json({ error: 'Invalid doctorId' }); }
    const appts = await Appointment.find({ doctorId: oid })
      .sort({ date: -1 })
      .select('patientId patientName date status');

    // Dedupe by patientId, keep most recent visit
    const seen = new Map();
    appts.forEach(a => {
      if (!seen.has(String(a.patientId))) {
        seen.set(String(a.patientId), {
          patientId:   a.patientId,
          patientName: a.patientName,
          lastVisit:   a.date,
          visits:      appts.filter(x => String(x.patientId) === String(a.patientId)).length,
        });
      }
    });

    // Enrich with Patient profile data
    const patientIds = [...seen.keys()];
    const patients = await Patient.find({ _id: { $in: patientIds } })
      .select('name phone gender dob bloodGroup conditions photo');

    const result = patients.map(p => {
      const apptInfo = seen.get(String(p._id)) || {};
      const age = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 31557600000) : null;
      return {
        patientId:   p._id,
        name:        p.name || apptInfo.patientName,
        phone:       p.phone,
        gender:      p.gender,
        age,
        bloodGroup:  p.bloodGroup,
        condition:   p.conditions?.[0] || '',
        photo:       p.photo,
        lastVisit:   apptInfo.lastVisit,
        visits:      apptInfo.visits,
      };
    });

    // Sort by lastVisit desc
    result.sort((a,b) => (b.lastVisit||'').localeCompare(a.lastVisit||''));
    res.json(result.slice(0, 10));
  } catch (err) { res.status(500).json({ error: err.message }); }
});




// ── Helper: add minutes to a 12h time string ──────────────────────────────────
function addMinutesToTime(timeStr, mins) {
  if (!timeStr) return timeStr;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return timeStr;
  let [, h, min, mer] = m; h = +h; min = +min;
  if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
  let total = h * 60 + min + mins;
  let nh = Math.floor(total / 60) % 24, nm = total % 60;
  const nmer = nh >= 12 ? 'PM' : 'AM';
  if (nh > 12) nh -= 12;
  if (nh === 0) nh = 12;
  return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')} ${nmer}`;
}

// ── POST /api/appointments/doctor/:doctorId/delay ─────────────────────────────
// Doctor marks running late — shifts all upcoming confirmed appts + SMS patients
// Body: { delayMinutes, reason }
router.post('/doctor/:doctorId/delay', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { delayMinutes, reason = 'Doctor is running late' } = req.body;

    if (!delayMinutes || delayMinutes < 1) {
      return res.status(400).json({ error: 'delayMinutes must be at least 1' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Find all upcoming confirmed/pending appointments for today after current time
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    const upcomingAppts = await Appointment.find({
      doctorId,
      date:   today,
      status: { $in: ['confirmed', 'pending'] },
    });

    // Filter to only appointments that haven't started yet
    const toNotify = upcomingAppts.filter(a => {
      const m = a.time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return false;
      let [, h, min, mer] = m; h = +h; min = +min;
      if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
      return (h * 60 + min) > nowMin;
    }).sort((a, b) => a.time > b.time ? 1 : -1);

    if (toNotify.length === 0) {
      return res.json({ notified: 0, message: 'No upcoming appointments to notify' });
    }

    // Update each appointment — shift estimated time + mark running late
    const smsPromises = [];
    for (const appt of toNotify) {
      const newEstimated = addMinutesToTime(appt.time, (appt.delayMinutes || 0) + delayMinutes);
      await Appointment.findByIdAndUpdate(appt._id, {
        $inc: { delayMinutes: delayMinutes },
        $set: {
          isRunningLate:   true,
          delayReason:     reason,
          delayNotifiedAt: new Date(),
        },
      });

      // SMS each affected patient
      if (appt.patientPhone) {
        const [y, mo, d] = appt.date.split('-').map(Number);
        const dateStr = new Date(y, mo-1, d).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
        smsPromises.push(
          sendStatusSMS({
            to:          appt.patientPhone,
            patientName: appt.patientName  || 'Patient',
            doctorName:  appt.doctorName   || 'Doctor',
            specialty:   appt.doctorSpecialty || '',
            date:        appt.date,
            time:        appt.time,
            type:        appt.type,
            status:      'delayed',
            delayMinutes: (appt.delayMinutes || 0) + delayMinutes,
            newEstimatedTime: newEstimated,
            reason,
          }).catch(err => console.error('[SMS delay] failed for', appt.patientName, err.message))
        );
      }
    }

    await Promise.allSettled(smsPromises);

    res.json({
      notified:   toNotify.length,
      delayMinutes,
      appointments: toNotify.map(a => ({
        id:          a._id,
        patientName: a.patientName,
        originalTime:a.time,
        newEstimated:addMinutesToTime(a.time, (a.delayMinutes || 0) + delayMinutes),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments/:id/complete-early ─────────────────────────────────
// Doctor finishes a session early — marks complete + SMS next patient to come early
router.post('/:id/complete-early', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'completed' } },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // Find the very next confirmed appointment for this doctor today
    const today = new Date().toISOString().split('T')[0];
    const allToday = await Appointment.find({
      doctorId: appt.doctorId,
      date:     today,
      status:   { $in: ['confirmed', 'pending'] },
    });

    // Sort by time, pick the one right after current
    const sorted = allToday.sort((a, b) => a.time > b.time ? 1 : -1);
    const nextAppt = sorted[0]; // earliest remaining

    if (nextAppt?.patientPhone) {
      sendStatusSMS({
        to:          nextAppt.patientPhone,
        patientName: nextAppt.patientName  || 'Patient',
        doctorName:  nextAppt.doctorName   || 'Doctor',
        specialty:   nextAppt.doctorSpecialty || '',
        date:        nextAppt.date,
        time:        nextAppt.time,
        type:        nextAppt.type,
        status:      'ready-early',
      }).catch(err => console.error('[SMS early] failed:', err.message));
    }

    res.json({ completed: appt, nextPatient: nextAppt || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/appointments/:id/delay-status ────────────────────────────────────
// Patient polls this to check if their appointment is delayed
router.get('/:id/delay-status', async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .select('delayMinutes delayReason isRunningLate time date status');
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json({
      isRunningLate:    appt.isRunningLate || false,
      delayMinutes:     appt.delayMinutes  || 0,
      delayReason:      appt.delayReason   || '',
      originalTime:     appt.time,
      estimatedTime:    addMinutesToTime(appt.time, appt.delayMinutes || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auto-detect delay: GET /api/appointments/doctor/:doctorId/check-overdue ───
// Called by doctor portal on a timer — returns appointments that have passed
// their scheduled time by > 10 mins and are still confirmed (not completed)
router.get('/doctor/:doctorId/check-overdue', async (req, res) => {
  try {
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const appts = await Appointment.find({
      doctorId: req.params.doctorId,
      date:     today,
      status:   'confirmed',
    });

    const overdue = appts.filter(a => {
      const m = a.time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return false;
      let [, h, min, mer] = m; h = +h; min = +min;
      if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
      const apptMin = h * 60 + min;
      return nowMin > apptMin + 10; // 10 min grace
    });

    res.json({ overdue: overdue.map(a => ({
      id:          a._id,
      patientName: a.patientName,
      time:        a.time,
      overdueBy:   (() => {
        const m = a.time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        let [, h, min, mer] = m; h = +h; min = +min;
        if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
        return nowMin - (h * 60 + min);
      })(),
    }))});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;