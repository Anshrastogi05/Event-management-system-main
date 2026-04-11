import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    bookingType: { type: String, enum: ['free', 'permanent'], default: 'free' },
    bookingReference: { type: String },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending_payment', 'registered', 'attended', 'cancelled'], default: 'registered' },
    paymentProvider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },
    qrCodeDataUrl: { type: String },
    checkedInAt: { type: Date },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
