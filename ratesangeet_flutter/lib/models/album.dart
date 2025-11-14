/// Album Model - Represents a music album
class Album {
  final String id;
  final String name;
  final String artistName;
  final int totalTracks;
  final String? imageUrl;
  final int? playCount;
  final int? albumPlayCount;
  final double? completionProgress;

  Album({
    required this.id,
    required this.name,
    required this.artistName,
    required this.totalTracks,
    this.imageUrl,
    this.playCount,
    this.albumPlayCount,
    this.completionProgress,
  });

  // Alias for compatibility with different naming conventions
  String? get albumArt => imageUrl;

  factory Album.fromJson(Map<String, dynamic> json) {
    return Album(
      id: json['albumId'] ?? json['id'] ?? '',
      name: json['albumName'] ?? json['name'] ?? '',
      artistName: json['artistName'] ?? json['artist'] ?? '',
      totalTracks: json['totalTracks'] ?? 0,
      imageUrl: json['albumArt'] ?? json['imageSmall'] ?? json['imageUrl'],
      playCount: json['count'] ?? json['playCount'],
      albumPlayCount: json['albumPlayCount'],
      completionProgress: (json['completionProgress'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'artistName': artistName,
        'totalTracks': totalTracks,
        'imageUrl': imageUrl,
        'playCount': playCount,
        'albumPlayCount': albumPlayCount,
        'completionProgress': completionProgress,
      };
}

/// Top Track Model - Track with play count
class TopTrack {
  final String spotifyId;
  final String name;
  final String artist;
  final int count;

  TopTrack({
    required this.spotifyId,
    required this.name,
    required this.artist,
    required this.count,
  });

  factory TopTrack.fromJson(Map<String, dynamic> json) {
    return TopTrack(
      spotifyId: json['spotifyId'] ?? '',
      name: json['name'] ?? '',
      artist: json['artist'] ?? '',
      count: json['count'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'spotifyId': spotifyId,
        'name': name,
        'artist': artist,
        'count': count,
      };
}
