const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true }
  },
  { timestamps: true, createdAt: true, updatedAt: false }
);

queueSchema.index({ adminId: 1, createdAt: -1 });
queueSchema.index({ title: 1 });

module.exports = mongoose.model('Queue', queueSchema);