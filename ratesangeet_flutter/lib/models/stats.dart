/// Stats Model - User listening statistics
class Stats {
  final int totalScrobbles;
  final int totalMinutes;
  final int uniqueArtistsCount;
  final LastScrobbled? lastScrobbled;

  Stats({
    required this.totalScrobbles,
    required this.totalMinutes,
    required this.uniqueArtistsCount,
    this.lastScrobbled,
  });

  factory Stats.fromJson(Map<String, dynamic> json) {
    return Stats(
      totalScrobbles: json['totalScrobbles'] ?? 0,
      totalMinutes: json['totalMinutes'] ?? 0,
      uniqueArtistsCount: json['uniqueArtistsCount'] ?? 0,
      lastScrobbled: json['lastScrobbled'] != null
          ? LastScrobbled.fromJson(json['lastScrobbled'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'totalScrobbles': totalScrobbles,
        'totalMinutes': totalMinutes,
        'uniqueArtistsCount': uniqueArtistsCount,
        'lastScrobbled': lastScrobbled?.toJson(),
      };
}

class LastScrobbled {
  final String spotifyId;
  final String trackName;
  final String artistName;
  final String? albumName;
  final DateTime playedAt;

  LastScrobbled({
    required this.spotifyId,
    required this.trackName,
    required this.artistName,
    this.albumName,
    required this.playedAt,
  });

  factory LastScrobbled.fromJson(Map<String, dynamic> json) {
    return LastScrobbled(
      spotifyId: json['spotifyId'] ?? '',
      trackName: json['trackName'] ?? '',
      artistName: json['artistName'] ?? '',
      albumName: json['albumName'],
      playedAt: DateTime.parse(json['playedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
        'spotifyId': spotifyId,
        'trackName': trackName,
        'artistName': artistName,
        'albumName': albumName,
        'playedAt': playedAt.toIso8601String(),
      };
}
