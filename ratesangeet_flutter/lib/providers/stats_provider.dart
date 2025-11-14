import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/stats.dart';
import '../models/album.dart';
import '../services/api_service.dart';
import 'auth_provider.dart';

/// Stats Provider - Fetches user stats from backend
final statsProvider = FutureProvider<Stats?>((ref) async {
  final authState = ref.watch(authProvider);
  
  if (!authState.isAuthenticated) {
    return null;
  }

  final apiService = ref.watch(apiServiceProvider);
  
  try {
    final data = await apiService.getStatsSummary();
    return Stats.fromJson(data);
  } catch (e) {
    print('Error fetching stats: $e');
    // Fallback mock data until V2 endpoints are implemented
    return Stats(
      totalMinutes: 0,
      totalScrobbles: 0,
      uniqueArtistsCount: 0,
      lastScrobbled: null,
    );
  }
});

/// Top Albums Provider - Fetches top albums
final topAlbumsProvider = FutureProvider<List<Album>>((ref) async {
  final authState = ref.watch(authProvider);
  
  if (!authState.isAuthenticated) {
    return [];
  }

  final apiService = ref.watch(apiServiceProvider);
  
  try {
    final data = await apiService.getTopAlbums(limit: 10);
    return data.map((json) => Album.fromJson(json as Map<String, dynamic>)).toList();
  } catch (e) {
    print('Error fetching top albums: $e');
    // Return empty list until V2 endpoints are implemented
    return [];
  }
});

/// Top Tracks Provider - Fetches top tracks
final topTracksProvider = FutureProvider<List<TopTrack>>((ref) async {
  final authState = ref.watch(authProvider);
  
  if (!authState.isAuthenticated) {
    return [];
  }

  final apiService = ref.watch(apiServiceProvider);
  
  try {
    final data = await apiService.getTopTracks(limit: 10);
    return data.map((json) => TopTrack.fromJson(json as Map<String, dynamic>)).toList();
  } catch (e) {
    print('Error fetching top tracks: $e');
    return [];
  }
});
