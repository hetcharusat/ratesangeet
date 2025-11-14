import 'package:dio/dio.dart';
import '../config/api_config.dart';

/// API Service - HTTP client for backend communication
class ApiService {
  late final Dio _dio;
  String? _accessToken;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.apiBaseUrl,
      connectTimeout: const Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: const Duration(milliseconds: ApiConfig.receiveTimeout),
      sendTimeout: const Duration(milliseconds: ApiConfig.sendTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptors for logging and error handling
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        // Add auth token to requests
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        print('🌐 API Request: ${options.method} ${options.path}');
        return handler.next(options);
      },
      onResponse: (response, handler) {
        print('✅ API Response: ${response.statusCode} ${response.requestOptions.path}');
        return handler.next(response);
      },
      onError: (error, handler) {
        print('❌ API Error: ${error.response?.statusCode} ${error.message}');
        return handler.next(error);
      },
    ));
  }

  /// Set access token for authenticated requests
  void setToken(String? token) {
    _accessToken = token;
  }

  /// Generic GET request
  Future<dynamic> get(String path, {Map<String, dynamic>? queryParams}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParams);
      return response.data; // Can be Map or List depending on endpoint
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Generic POST request
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? data}) async {
    try {
      final response = await _dio.post(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Generic PUT request
  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? data}) async {
    try {
      final response = await _dio.put(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Generic DELETE request
  Future<Map<String, dynamic>> delete(String path) async {
    try {
      final response = await _dio.delete(path);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Handle API errors
  String _handleError(DioException error) {
    if (error.response != null) {
      final statusCode = error.response!.statusCode;
      final data = error.response!.data;

      switch (statusCode) {
        case 400:
          return data['error'] ?? 'Bad request';
        case 401:
          return 'Unauthorized - Please log in again';
        case 403:
          return 'Forbidden - Access denied';
        case 404:
          return 'Resource not found';
        case 429:
          return 'Too many requests - Please try again later';
        case 500:
          return 'Server error - Please try again later';
        default:
          return data['error'] ?? 'An error occurred';
      }
    } else if (error.type == DioExceptionType.connectionTimeout) {
      return 'Connection timeout - Please check your internet';
    } else if (error.type == DioExceptionType.receiveTimeout) {
      return 'Receive timeout - Server took too long to respond';
    } else if (error.type == DioExceptionType.sendTimeout) {
      return 'Send timeout - Request took too long to send';
    } else {
      return 'Network error - Please check your connection';
    }
  }

  // ========================================
  // AUTH ENDPOINTS
  // ========================================

  /// Exchange Spotify OAuth code for tokens
  Future<Map<String, dynamic>> exchangeCode({
    required String code,
    required String redirectUri,
    String? codeVerifier,
    String target = 'mobile',
  }) async {
    // Use full URL because auth endpoint is outside the /api/v2 baseUrl
    final fullUrl = '${ApiConfig.backendUrl}${ApiConfig.authCallback}';
    final response = await _dio.post(fullUrl, data: {
      'code': code,
      'redirectUri': redirectUri,
      'target': target,
      if (codeVerifier != null) 'codeVerifier': codeVerifier,
    });
    return response.data as Map<String, dynamic>;
  }

  // ========================================
  // STATS ENDPOINTS
  // ========================================

  /// Get user stats summary
  Future<Map<String, dynamic>> getStatsSummary() async {
    final response = await get(ApiConfig.statsSummary);
    return response as Map<String, dynamic>;
  }

  /// Get top albums
  Future<List<dynamic>> getTopAlbums({int limit = 10}) async {
    final response = await get(ApiConfig.getTopAlbumsUrl(limit: limit));
    // V2 endpoint returns array directly, not wrapped in 'albums' key
    return response is List ? response : (response['albums'] ?? []);
  }

  /// Get top tracks
  Future<List<dynamic>> getTopTracks({int limit = 10}) async {
    final response = await get(ApiConfig.getTopTracksUrl(limit: limit));
    return response['tracks'] ?? [];
  }

  // ========================================
  // SCROBBLES ENDPOINTS
  // ========================================

  /// Get recent scrobbles
  Future<List<dynamic>> getRecentScrobbles({
    int limit = ApiConfig.defaultLimit,
    String? before,
    bool includeSkips = false,
  }) async {
    final response = await get(
      ApiConfig.getRecentScrobblesUrl(
        limit: limit,
        before: before,
        includeSkips: includeSkips,
      ),
    );
    return response['scrobbles'] ?? [];
  }

  /// Batch upsert scrobbles
  Future<Map<String, dynamic>> batchUpsertScrobbles(List<Map<String, dynamic>> items) async {
    return await post(ApiConfig.scrobblesBatchUpsert, data: {'items': items});
  }

  // ========================================
  // SPOTIFY INTEGRATION ENDPOINTS
  // ========================================

  /// Get now playing track
  Future<Map<String, dynamic>?> getNowPlaying() async {
    try {
      final response = await get(ApiConfig.nowPlaying);
      return response as Map<String, dynamic>?;
    } catch (e) {
      // Return null if no track is playing or error occurs
      return null;
    }
  }

  /// Get playing progress
  Future<Map<String, dynamic>?> getPlayingProgress() async {
    try {
      return await get(ApiConfig.playingProgress);
    } catch (e) {
      return null;
    }
  }

  // ========================================
  // MUSIC DATA ENDPOINTS
  // ========================================

  /// Get track by ID
  Future<Map<String, dynamic>> getTrack(String id) async {
    return await get(ApiConfig.getTrackUrl(id));
  }

  /// Get album by ID
  Future<Map<String, dynamic>> getAlbum(String id) async {
    return await get(ApiConfig.getAlbumUrl(id));
  }

  /// Get artist by ID
  Future<Map<String, dynamic>> getArtist(String id) async {
    return await get(ApiConfig.getArtistUrl(id));
  }

  /// Get track credits
  Future<Map<String, dynamic>> getCredits(String trackId) async {
    return await get(ApiConfig.getCreditsUrl(trackId));
  }
}
