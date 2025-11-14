import mongoose, { Schema, Document } from 'mongoose';

export interface IArtist extends Document {
  name: string;
  spotifyId?: string; // Optional, may not always be available
  createdAt: Date;
  updatedAt: Date;
}

const ArtistSchema = new Schema<IArtist>({
  name: {
    type: String,
    required: true,
  },
  spotifyId: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
});

// Indexes for performance
ArtistSchema.index({ name: 1 }, { unique: true });
ArtistSchema.index({ spotifyId: 1 }, { sparse: true });

const Artist = mongoose.model<IArtist>('Artist', ArtistSchema);

export default Artist;
