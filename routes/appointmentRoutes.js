const express  = require('express');
const router   = express.Router();
const Appointment = require('../models/Appointment');
const Doctor   = require('../models/Doctor');
const Patient  = require('../models/Patient');

// ── POST /api/appointments/book ───────────────────────────────────────────────
// Called when patient clicks "Confirm Booking"
router.post('/book', async (req, res) => {
  try {
    const { patientId, doctorId, date, time, type, reason } = req.body;

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

module.exports = router;


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