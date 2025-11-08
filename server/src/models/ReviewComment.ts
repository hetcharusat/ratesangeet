import mongoose, { Document, Schema } from 'mongoose';

export interface IReviewComment extends Document {
  reviewId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username?: string; // Denormalized for faster queries
  text: string;
  parentId?: mongoose.Types.ObjectId | null;
  reactionsCount?: Map<string, number>; // emoji reaction counts by type
  reactionsByUser?: Map<string, string>; // userId -> reaction type (single-select)
  depth: number; // Thread depth for UI rendering (0 = top-level)
  replyCount: number; // Number of direct replies
  createdAt: Date;
  updatedAt: Date;
}

const reviewCommentSchema = new Schema<IReviewComment>({
  reviewId: { type: Schema.Types.ObjectId, ref: 'Review', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String }, // Denormalized for faster display
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  parentId: { type: Schema.Types.ObjectId, ref: 'ReviewComment', default: null },
  reactionsCount: { type: Map, of: Number, default: {} },
  reactionsByUser: { type: Map, of: String, default: {} },
  depth: { type: Number, default: 0, min: 0 },
  replyCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for efficient nested thread queries
reviewCommentSchema.index({ reviewId: 1, createdAt: -1 });
reviewCommentSchema.index({ parentId: 1, createdAt: 1 }); // Replies in chronological order
reviewCommentSchema.index({ userId: 1 });

export default mongoose.model<IReviewComment>('ReviewComment', reviewCommentSchema);
