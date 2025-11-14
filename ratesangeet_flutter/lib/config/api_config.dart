/// API Configuration for RateSangeet
/// Contains backend URL, Spotify OAuth credentials, and API endpoints
class ApiConfig {
  // Backend API URL (Render deployment)
  static const String backendUrl = 'https://ratesangeet.onrender.com';
  static const String apiBaseUrl = '$backendUrl/api/v2';

  // Spotify OAuth Configuration
  static const String spotifyClientId = '30d78a30cd9f435eba6edbaa4a427041';
  static const String spotifyRedirectUri = 'ratesangeet://callback';
  static const String spotifyAuthUrl = 'https://accounts.spotify.com/authorize';
  static const String spotifyTokenUrl = 'https://accounts.spotify.com/api/token';

  // API Endpoints - Auth
  static const String authCallback = '/api/auth/callback';

  // API Endpoints - Scrobbles
  static const String scrobblesBatchUpsert = '/api/v2/scrobbles/batch-upsert';
  static const String scrobblesRecent = '/api/v2/scrobbles/recent';
  static const String scrobblesArchiveReady = '/api/v2/scrobbles/archive-ready';
  static const String scrobblesAckArchive = '/api/v2/scrobbles/ack-archive';

  // API Endpoints - Stats
  static const String statsSummary = '/api/v2/stats/summary';
  static const String statsTopAlbums = '/api/v2/stats/top-albums';
  static const String statsTopTracks = '/api/v2/stats/top-tracks';

  // API Endpoints - Music Data
  static const String track = '/api/v2/track';
  static const String album = '/api/v2/album';
  static const String artist = '/api/v2/artist';
  static const String credits = '/api/v2/credits';

  // API Endpoints - Spotify Integration
  static const String nowPlaying = '/api/v2/now-playing';
  static const String playingProgress = '/api/v2/playing-progress';

  // Request Configuration
  static const int connectTimeout = 30000; // 30 seconds
  static const int receiveTimeout = 30000; // 30 seconds
  static const int sendTimeout = 30000; // 30 seconds

  // Pagination Defaults
  static const int defaultLimit = 20;
  static const int maxLimit = 100;

  // OAuth Scopes
  static const List<String> spotifyScopes = [
    'user-read-email',
    'user-read-private',
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-read-recently-played',
    'user-top-read',
  ];

  // Helper Methods
  static String getTrackUrl(String id) => '$track/$id';
  static String getAlbumUrl(String id) => '$album/$id';
  static String getArtistUrl(String id) => '$artist/$id';
  static String getCreditsUrl(String trackId) => '$credits/$trackId';

  static String getRecentScrobblesUrl({int limit = defaultLimit, String? before, bool includeSkips = false}) {
    final params = <String>[];
    params.add('limit=$limit');
    if (before != null) params.add('before=$before');
    if (includeSkips) params.add('include=skips');
    return '$scrobblesRecent?${params.join('&')}';
  }

  static String getTopAlbumsUrl({int limit = 10}) {
    return '$statsTopAlbums?limit=$limit';
  }

  static String getTopTracksUrl({int limit = 10}) {
    return '$statsTopTracks?limit=$limit';
  }
}
