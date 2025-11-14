/// Track Model - Represents a music track
class Track {
  final String id;
  final String name;
  final String albumId;
  final String albumName;
  final String artistId;
  final String artistName;
  final int durationMs;
  final String? imageUrl;

  Track({
    required this.id,
    required this.name,
    required this.albumId,
    required this.albumName,
    required this.artistId,
    required this.artistName,
    required this.durationMs,
    this.imageUrl,
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      albumId: json['albumId'] ?? '',
      albumName: json['albumName'] ?? '',
      artistId: json['artistId'] ?? '',
      artistName: json['artistName'] ?? '',
      durationMs: json['durationMs'] ?? 0,
      imageUrl: json['imageSmall'] ?? json['imageUrl'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'albumId': albumId,
        'albumName': albumName,
        'artistId': artistId,
        'artistName': artistName,
        'durationMs': durationMs,
        'imageUrl': imageUrl,
      };
}

/// Now Playing Model - Current Spotify playback
class NowPlaying {
  final String trackId;
  final String trackName;
  final String? albumId;
  final String artistName;
  final int progressMs;
  final int durationMs;
  final bool isPlaying;
  final String? deviceName;
  final String? imageUrl;

  const NowPlaying({
    required this.trackId,
    required this.trackName,
    this.albumId,
    required this.artistName,
    required this.progressMs,
    required this.durationMs,
    required this.isPlaying,
    this.deviceName,
    this.imageUrl,
  });

  factory NowPlaying.fromJson(Map<String, dynamic> json) {
    return NowPlaying(
      trackId: json['trackId'] ?? '',
      trackName: json['trackName'] ?? '',
      albumId: json['albumId'],
      artistName: json['artistName'] ?? '',
      progressMs: json['progressMs'] ?? 0,
      durationMs: json['durationMs'] ?? 0,
      isPlaying: json['isPlaying'] ?? false,
      deviceName: json['deviceName'],
      imageUrl: json['imageUrl'],
    );
  }

  Map<String, dynamic> toJson() => {
        'trackId': trackId,
        'trackName': trackName,
        'albumId': albumId,
        'artistName': artistName,
        'progressMs': progressMs,
        'durationMs': durationMs,
        'isPlaying': isPlaying,
        'deviceName': deviceName,
        'imageUrl': imageUrl,
      };

  double get progress => durationMs > 0 ? progressMs / durationMs : 0.0;
}
