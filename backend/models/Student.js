/**
 * SmartAttend – backend/models/Student.js
 * Mongoose schema/model for students.
 */

const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters']
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    class: {
      type: String,
      required: [true, 'Class / section is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    phone: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true // Adds createdAt & updatedAt automatically
  }
);

module.exports = mongoose.model('Student', StudentSchema);