import mongoose, { Schema, Document } from 'mongoose';

export interface IAlbum extends Document {
  spotifyId: string;
  name: string;
  artistId: mongoose.Types.ObjectId; // Reference to Artist
  albumArt?: string; // Spotify album art URL
  totalTracks?: number;
  releaseDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlbumSchema = new Schema<IAlbum>({
  spotifyId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  artistId: {
    type: Schema.Types.ObjectId,
    ref: 'Artist',
    required: true,
  },
  albumArt: {
    type: String,
    required: false, // Optional, may not always be available
  },
  totalTracks: {
    type: Number,
    required: false,
  },
  releaseDate: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
});

// Indexes for performance
AlbumSchema.index({ spotifyId: 1 }, { unique: true });
AlbumSchema.index({ name: 1 });
AlbumSchema.index({ artistId: 1 });

const Album = mongoose.model<IAlbum>('Album', AlbumSchema);

export default Album;
