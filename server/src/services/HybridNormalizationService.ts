import mongoose from 'mongoose';
import Track from '../models/Track';
import Album from '../models/Album';
import Artist from '../models/Artist';

/**
 * Hybrid Normalization Service
 * Manages Track, Album, Artist collections for storage optimization
 */

export class HybridNormalizationService {
  /**
   * Find or create an artist by name
   */
  static async findOrCreateArtist(artistName: string, spotifyId?: string): Promise<mongoose.Types.ObjectId> {
    const artist = await Artist.findOneAndUpdate(
      { name: artistName },
      {
        $setOnInsert: {
          name: artistName,
          spotifyId,
        },
      },
      { upsert: true, new: true }
    );
    return artist._id as mongoose.Types.ObjectId;
  }

  /**
   * Find or create an album
   */
  static async findOrCreateAlbum(
    albumSpotifyId: string,
    albumName: string,
    artistId: mongoose.Types.ObjectId,
    albumArt?: string,
    totalTracks?: number
  ): Promise<mongoose.Types.ObjectId> {
    const album = await Album.findOneAndUpdate(
      { spotifyId: albumSpotifyId },
      {
        $setOnInsert: {
          spotifyId: albumSpotifyId,
          name: albumName,
          artistId,
        },
        $set: {
          ...(albumArt && { albumArt }),
          ...(totalTracks && { totalTracks }),
        },
      },
      { upsert: true, new: true }
    );
    return album._id as mongoose.Types.ObjectId;
  }

  /**
   * Find or create a track
   */
  static async findOrCreateTrack(
    spotifyId: string,
    trackName: string,
    albumId: mongoose.Types.ObjectId,
    durationMs: number
  ): Promise<mongoose.Types.ObjectId> {
    const track = await Track.findOneAndUpdate(
      { spotifyId },
      {
        $setOnInsert: {
          spotifyId,
          name: trackName,
          albumId,
          durationMs,
        },
      },
      { upsert: true, new: true }
    );
    return track._id as mongoose.Types.ObjectId;
  }

  /**
   * Complete scrobble normalization flow
   * Creates/updates Track, Album, Artist and returns their IDs
   */
  static async normalizeScrobbleData(data: {
    spotifyId: string;
    trackName: string;
    artistName: string;
    albumSpotifyId: string;
    albumName: string;
    albumArt?: string;
    durationMs: number;
    totalTracks?: number;
  }): Promise<{
    trackId: mongoose.Types.ObjectId;
    albumId: mongoose.Types.ObjectId;
    artistId: mongoose.Types.ObjectId;
  }> {
    // 1. Create/find artist
    const artistId = await this.findOrCreateArtist(data.artistName);

    // 2. Create/find album
    const albumId = await this.findOrCreateAlbum(
      data.albumSpotifyId,
      data.albumName,
      artistId,
      data.albumArt,
      data.totalTracks
    );

    // 3. Create/find track
    const trackId = await this.findOrCreateTrack(
      data.spotifyId,
      data.trackName,
      albumId,
      data.durationMs
    );

    return { trackId, albumId, artistId };
  }

  /**
   * Get album art URL from Album collection
   */
  static async getAlbumArt(albumRefId: mongoose.Types.ObjectId): Promise<string | undefined> {
    const album = await Album.findById(albumRefId).select('albumArt').lean();
    return album?.albumArt;
  }

  /**
   * Bulk get album arts for multiple albums (for populating scrobble lists)
   */
  static async bulkGetAlbumArts(albumRefIds: mongoose.Types.ObjectId[]): Promise<Map<string, string>> {
    const albums = await Album.find({ _id: { $in: albumRefIds } })
      .select('_id albumArt')
      .lean();

    const map = new Map<string, string>();
    albums.forEach(album => {
      if (album.albumArt) {
        map.set(album._id.toString(), album.albumArt);
      }
    });
    return map;
  }
}
