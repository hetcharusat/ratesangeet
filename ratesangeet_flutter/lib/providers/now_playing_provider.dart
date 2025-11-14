import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/track.dart';
import '../services/api_service.dart';
import 'auth_provider.dart';

/// Now Playing State
class NowPlayingState {
  final NowPlaying? track;
  final bool isLoading;
  final String? error;

  NowPlayingState({
    this.track,
    this.isLoading = false,
    this.error,
  });

  NowPlayingState copyWith({
    NowPlaying? track,
    bool? isLoading,
    String? error,
  }) {
    return NowPlayingState(
      track: track ?? this.track,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

/// Now Playing Provider - Polls Spotify current playback
final nowPlayingProvider = NotifierProvider<NowPlayingNotifier, NowPlayingState>(() {
  return NowPlayingNotifier();
});

class NowPlayingNotifier extends Notifier<NowPlayingState> {
  Timer? _pollingTimer;
  late ApiService _apiService;

  @override
  NowPlayingState build() {
    _apiService = ref.watch(apiServiceProvider);
    final authState = ref.watch(authProvider);
    
    // Start polling if authenticated
    if (authState.isAuthenticated) {
      _startPolling();
    }
    
    // Stop polling when provider is disposed
    ref.onDispose(() {
      _pollingTimer?.cancel();
    });
    
    return NowPlayingState();
  }

  /// Start polling for now playing data
  void _startPolling() {
    // Poll every 5 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _fetchNowPlaying();
    });
    
    // Initial fetch
    _fetchNowPlaying();
  }

  /// Fetch current playback from backend
  Future<void> _fetchNowPlaying() async {
    try {
      final data = await _apiService.getNowPlaying();
      
      if (data != null) {
        final nowPlaying = NowPlaying.fromJson(data);
        state = state.copyWith(track: nowPlaying, isLoading: false, error: null);
      } else {
        // No track playing
        state = state.copyWith(track: null, isLoading: false, error: null);
      }
    } catch (e) {
      print('Error fetching now playing: $e');
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// Manually refresh now playing
  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    await _fetchNowPlaying();
  }

  /// Stop polling (call when logging out)
  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
    state = NowPlayingState();
  }
}
