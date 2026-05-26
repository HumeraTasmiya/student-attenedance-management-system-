/**
 * SmartAttend – backend/routes/attendance.js
 * REST API routes for attendance records.
 */

const express    = require('express');
const router     = express.Router();
const Attendance = require('../models/Attendance');
const Student    = require('../models/Student');

// ──────────────────────────────────────────────
// GET /api/attendance
// Fetch all attendance records
// Supports ?date=YYYY-MM-DD and ?studentId=<id>
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { date, studentId } = req.query;
    const query = {};

    if (date)      query.date      = date;
    if (studentId) query.studentId = studentId;

    const records = await Attendance.find(query)
      .populate('studentId', 'name rollNo class') // Join student info
      .sort({ date: -1, markedAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance', details: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/attendance
// Mark / bulk-save attendance for a date
// Body: { date: 'YYYY-MM-DD', records: [{ studentId, status }] }
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records[] are required' });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    // Use bulkWrite with upsert to handle existing records
    const ops = records.map(r => ({
      updateOne: {
        filter: { studentId: r.studentId, date },
        update: { $set: { status: r.status, markedAt: new Date() } },
        upsert: true
      }
    }));

    const result = await Attendance.bulkWrite(ops);

    res.status(201).json({
      message: `Attendance saved for ${date}`,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save attendance', details: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/attendance/summary
// Get attendance summary stats
// ──────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalStudents, todayRecords, allRecords] = await Promise.all([
      Student.countDocuments(),
      Attendance.find({ date: today }),
      Attendance.find()
    ]);

    const presentToday = todayRecords.filter(r => r.status === 'Present').length;
    const absentToday  = todayRecords.filter(r => r.status === 'Absent').length;
    const totalMarked  = allRecords.length;
    const totalPresent = allRecords.filter(r => r.status === 'Present').length;
    const avgAttendance = totalMarked > 0
      ? Math.round((totalPresent / totalMarked) * 100) : 0;

    res.json({ totalStudents, presentToday, absentToday, avgAttendance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', details: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/attendance/:id
// Delete a specific attendance record
// ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Attendance record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record', details: err.message });
  }
});

module.exports = router;