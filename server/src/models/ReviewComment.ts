import mongoose, { Document, Schema } from 'mongoose';

export interface IReviewComment extends Document {
  reviewId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  text: string;
  parentId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const reviewCommentSchema = new Schema<IReviewComment>({
  reviewId: { type: Schema.Types.ObjectId, ref: 'Review', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  parentId: { type: Schema.Types.ObjectId, ref: 'ReviewComment', default: null },
  createdAt: { type: Date, default: Date.now },
});

reviewCommentSchema.index({ reviewId: 1, createdAt: -1 });
reviewCommentSchema.index({ parentId: 1 });

export default mongoose.model<IReviewComment>('ReviewComment', reviewCommentSchema);
