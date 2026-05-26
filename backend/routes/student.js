/**
 * SmartAttend – backend/routes/students.js
 * REST API routes for student CRUD operations.
 */

const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');

// ──────────────────────────────────────────────
// GET /api/students
// Fetch all students (supports ?search= query)
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    // Optional search by name, rollNo, or class
    if (search) {
      const regex = new RegExp(search, 'i');
      query = { $or: [{ name: regex }, { rollNo: regex }, { class: regex }] };
    }

    const students = await Student.find(query).sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students', details: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/students/:id
// Fetch single student by ID
// ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student', details: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/students
// Add a new student
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, rollNo, class: cls, email, phone } = req.body;

    // Check for duplicate roll number
    const existing = await Student.findOne({ rollNo: rollNo?.toUpperCase() });
    if (existing) {
      return res.status(409).json({ error: 'A student with this roll number already exists' });
    }

    const student = new Student({ name, rollNo, class: cls, email, phone });
    const saved   = await student.save();
    res.status(201).json(saved);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    res.status(500).json({ error: 'Failed to add student', details: err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/students/:id
// Update a student
// ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, rollNo, class: cls, email, phone } = req.body;

    // Check duplicate roll (exclude self)
    const existing = await Student.findOne({ rollNo: rollNo?.toUpperCase(), _id: { $ne: req.params.id } });
    if (existing) {
      return res.status(409).json({ error: 'Another student already has this roll number' });
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, rollNo, class: cls, email, phone },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: 'Student not found' });
    res.json(updated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    res.status(500).json({ error: 'Failed to update student', details: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/students/:id
// Delete a student
// ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Also delete all attendance records for this student
    const Attendance = require('../models/Attendance');
    await Attendance.deleteMany({ studentId: req.params.id });

    res.json({ message: 'Student and related attendance records deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student', details: err.message });
  }
});

module.exports = router;