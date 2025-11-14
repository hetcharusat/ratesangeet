import mongoose, { Schema, Document } from 'mongoose';

export interface ITrack extends Document {
  spotifyId: string;
  name: string;
  albumId: mongoose.Types.ObjectId; // Reference to Album
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const TrackSchema = new Schema<ITrack>({
  spotifyId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  albumId: {
    type: Schema.Types.ObjectId,
    ref: 'Album',
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
TrackSchema.index({ spotifyId: 1 }, { unique: true });
TrackSchema.index({ name: 1 });
TrackSchema.index({ albumId: 1 });

const Track = mongoose.model<ITrack>('Track', TrackSchema);

export default Track;
