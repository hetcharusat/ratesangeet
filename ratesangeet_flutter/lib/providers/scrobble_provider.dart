import 'package:flutter_riverpod/flutter_riverpod.dart';

// Scrobble Model
class Scrobble {
  final String spotifyId;
  final String trackName;
  final String artistName;
  final String? albumName;
  final String? albumId;
  final int durationMs;
  final DateTime playedAt;
  final bool isScrobbled;

  Scrobble({
    required this.spotifyId,
    required this.trackName,
    required this.artistName,
    this.albumName,
    this.albumId,
    required this.durationMs,
    required this.playedAt,
    this.isScrobbled = true,
  });

  factory Scrobble.fromJson(Map<String, dynamic> json) {
    return Scrobble(
      spotifyId: json['spotifyId'] ?? '',
      trackName: json['trackName'] ?? '',
      artistName: json['artistName'] ?? '',
      albumName: json['albumName'],
      albumId: json['albumId'],
      durationMs: json['durationMs'] ?? 0,
      playedAt: DateTime.parse(json['playedAt']),
      isScrobbled: json['isScrobbled'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'spotifyId': spotifyId,
    'trackName': trackName,
    'artistName': artistName,
    'albumName': albumName,
    'albumId': albumId,
    'durationMs': durationMs,
    'playedAt': playedAt.toIso8601String(),
    'isScrobbled': isScrobbled,
  };
}

// Scrobble State
class ScrobbleState {
  final List<Scrobble> recentScrobbles;
  final bool isLoading;
  final String? error;
  final List<Scrobble> localQueue;

  ScrobbleState({
    this.recentScrobbles = const [],
    this.isLoading = false,
    this.error,
    this.localQueue = const [],
  });

  ScrobbleState copyWith({
    List<Scrobble>? recentScrobbles,
    bool? isLoading,
    String? error,
    List<Scrobble>? localQueue,
  }) {
    return ScrobbleState(
      recentScrobbles: recentScrobbles ?? this.recentScrobbles,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      localQueue: localQueue ?? this.localQueue,
    );
  }
}

// Scrobble Notifier
class ScrobbleNotifier extends Notifier<ScrobbleState> {
  @override
  ScrobbleState build() => ScrobbleState();

  void addToQueue(Scrobble scrobble) {
    final updated = [...state.localQueue, scrobble];
    state = state.copyWith(localQueue: updated);
  }

  void clearQueue() {
    state = state.copyWith(localQueue: []);
  }

  void setRecentScrobbles(List<Scrobble> scrobbles) {
    state = state.copyWith(
      recentScrobbles: scrobbles,
      isLoading: false,
    );
  }

  void setLoading(bool isLoading) {
    state = state.copyWith(isLoading: isLoading);
  }

  void setError(String error) {
    state = state.copyWith(error: error, isLoading: false);
  }
}

// Scrobble Provider
final scrobbleProvider = NotifierProvider<ScrobbleNotifier, ScrobbleState>(() {
  return ScrobbleNotifier();
});
