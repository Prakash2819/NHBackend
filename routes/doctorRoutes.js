const express = require("express");
const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");

const router = express.Router();


// ================= DOCTOR SIGNUP =================
router.post("/doctor-signup", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingDoctor = await Doctor.findOne({ email });

    if (existingDoctor) {
      return res.status(400).json({ message: "Account already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const doctor = await Doctor.create({
      name,
      email,
      password: hashedPassword,
      specialization,
    });

    res.json({
      success: true,
      message: "Signup successful. Waiting for admin approval",
      doctor,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});


// ================= DOCTOR LOGIN =================
router.post("/doctor-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doctor = await Doctor.findOne({ email });

    if (!doctor) {
      return res.status(400).json({ message: "Account not found" });
    }

    if (doctor.status === "pending") {
      return res.status(403).json({
        message: "Your account is waiting for admin approval"
      });
    }

    if (doctor.status === "rejected") {
      return res.status(403).json({
        message: "Your account was rejected by admin"
      });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    res.json({
      message: 'Login successful',
      doctor: {
        _id:            doctor._id,   
        name:           doctor.name,   
        email:          doctor.email,
        role:           doctor.role,
        status:         doctor.status,
        specialization: doctor.specialization,
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;