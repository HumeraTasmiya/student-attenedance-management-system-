/**
 * SmartAttend – backend/models/Attendance.js
 * Mongoose schema/model for attendance records.
 */

const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required']
    },
    date: {
      type: String, // Store as 'YYYY-MM-DD' string for easy filtering
      required: [true, 'Attendance date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
    },
    status: {
      type: String,
      enum: { values: ['Present', 'Absent'], message: 'Status must be Present or Absent' },
      required: [true, 'Attendance status is required']
    },
    markedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index: one record per student per date
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);