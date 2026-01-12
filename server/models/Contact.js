import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'closed'],
    default: 'new',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

contactSchema.index({ userId: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

export const Contact = mongoose.model('Contact', contactSchema);
