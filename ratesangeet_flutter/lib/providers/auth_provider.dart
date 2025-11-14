import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/spotify_auth_service.dart';

// Auth State
class AuthState {
  final String? accessToken;
  final String? refreshToken;
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState({
    this.accessToken,
    this.refreshToken,
    this.user,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => accessToken != null && user != null;

  AuthState copyWith({
    String? accessToken,
    String? refreshToken,
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

// API Service Provider (Singleton)
final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

// Spotify Auth Service Provider
final spotifyAuthServiceProvider = Provider<SpotifyAuthService>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return SpotifyAuthService(apiService);
});

// Auth Provider
final authProvider = NotifierProvider<AuthNotifier, AuthState>(() {
  return AuthNotifier();
});

class AuthNotifier extends Notifier<AuthState> {
  late ApiService _apiService;
  late SpotifyAuthService _spotifyAuthService;
  Box? _authBox;

  @override
  AuthState build() {
    // Initialize services from other providers
    _apiService = ref.watch(apiServiceProvider);
    _spotifyAuthService = ref.watch(spotifyAuthServiceProvider);
    
    // Load saved auth state
    _initAuth();
    
    return AuthState();
  }

  /// Initialize auth - Load saved tokens from Hive
  Future<void> _initAuth() async {
    try {
      _authBox = await Hive.openBox('auth');
      final accessToken = _authBox?.get('accessToken');
      final refreshToken = _authBox?.get('refreshToken');
      final userData = _authBox?.get('user');

      if (accessToken != null && userData != null) {
        final user = User.fromJson(Map<String, dynamic>.from(userData));
        _apiService.setToken(accessToken);
        state = state.copyWith(
          accessToken: accessToken,
          refreshToken: refreshToken,
          user: user,
        );
      }
    } catch (e) {
      print('Error initializing auth: $e');
    }
  }

  /// Start Spotify OAuth login flow
  Future<void> login() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await _spotifyAuthService.startAuthFlow();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to start login: ${e.toString()}',
      );
    }
  }

  /// Handle OAuth callback (called from deep link handler)
  Future<void> handleCallback(Uri uri) async {
    try {
      state = state.copyWith(isLoading: true, error: null);

      final result = await _spotifyAuthService.handleCallback(uri);
      final accessToken = result['accessToken'] as String;
      final refreshToken = result['refreshToken'] as String?;
      final userData = result['user'] as Map<String, dynamic>;

      final user = User.fromJson(userData);

      // Save tokens to Hive
      await _authBox?.put('accessToken', accessToken);
      if (refreshToken != null) {
        await _authBox?.put('refreshToken', refreshToken);
      }
      await _authBox?.put('user', userData);

      // Update API service with token
      _apiService.setToken(accessToken);

      state = state.copyWith(
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: user,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Login failed: ${e.toString()}',
      );
    }
  }

  /// Logout - Clear tokens and user data
  Future<void> logout() async {
    await _authBox?.clear();
    _apiService.setToken(null);
    state = AuthState();
  }
}
