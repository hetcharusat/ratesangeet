import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  itemType: 'track' | 'album';
  spotifyId: string;
  itemName: string;
  artistName: string;
  albumArt?: string;
  rating: number; // 0.5-5.0 scale (half-star increments, like Letterboxd)
  reviewText?: string;
  isPublic: boolean; // Public by default (like Letterboxd)
  likes: number; // Number of likes
  reactionsCount?: Map<string, number>; // emoji reaction counts by type
  reactionsByUser?: Map<string, string>; // userId -> reaction type
  listeningDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, enum: ['track', 'album'], required: true },
  spotifyId: { type: String, required: true },
  itemName: { type: String, required: true },
  artistName: { type: String, required: true },
  albumArt: { type: String },
  rating: { 
    type: Number, 
    required: true, 
    min: 0.5, 
    max: 5,
    validate: {
      validator: function(v: number) {
        // Must be in 0.5 increments (0.5, 1.0, 1.5, 2.0, ..., 5.0)
        return (v * 2) % 1 === 0;
      },
      message: 'Rating must be in 0.5 increments (e.g., 3.5, 4.0)'
    }
  },
  reviewText: { type: String },
  isPublic: { type: Boolean, default: true },
  likes: { type: Number, default: 0 },
  reactionsCount: { type: Map, of: Number, default: {} },
  reactionsByUser: { type: Map, of: String, default: {} },
  listeningDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for faster queries
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ spotifyId: 1, userId: 1 });

export default mongoose.model<IReview>('Review', reviewSchema);
