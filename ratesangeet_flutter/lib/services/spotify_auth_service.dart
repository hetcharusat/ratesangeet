import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import '../config/api_config.dart';
import 'api_service.dart';

/// Spotify Auth Service - Handles OAuth PKCE flow
class SpotifyAuthService {
  final ApiService _apiService;
  final AppLinks _appLinks = AppLinks();

  String? _codeVerifier;
  String? _state;

  SpotifyAuthService(this._apiService);

  /// Generate PKCE code verifier (random 128-char string)
  String _generateCodeVerifier() {
    final random = Random.secure();
    final values = List<int>.generate(96, (i) => random.nextInt(256));
    return base64UrlEncode(values)
        .replaceAll('=', '')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .substring(0, 128);
  }

  /// Generate PKCE code challenge (SHA256 hash of verifier)
  String _generateCodeChallenge(String verifier) {
    final bytes = utf8.encode(verifier);
    final digest = sha256.convert(bytes);
    return base64UrlEncode(digest.bytes)
        .replaceAll('=', '')
        .replaceAll('+', '-')
        .replaceAll('/', '_');
  }

  /// Generate random state for CSRF protection
  String _generateState() {
    final random = Random.secure();
    final values = List<int>.generate(32, (i) => random.nextInt(256));
    return base64UrlEncode(values).replaceAll('=', '');
  }

  /// Start OAuth flow - Opens Spotify authorization in browser
  Future<void> startAuthFlow() async {
    // Generate PKCE parameters
    _codeVerifier = _generateCodeVerifier();
    _state = _generateState();
    final codeChallenge = _generateCodeChallenge(_codeVerifier!);

    // Build authorization URL
    final params = {
      'client_id': ApiConfig.spotifyClientId,
      'response_type': 'code',
      'redirect_uri': ApiConfig.spotifyRedirectUri,
      'code_challenge_method': 'S256',
      'code_challenge': codeChallenge,
      'state': _state,
      'scope': ApiConfig.spotifyScopes.join(' '),
    };

    final uri = Uri.parse(ApiConfig.spotifyAuthUrl).replace(
      queryParameters: params,
    );

    // Open Spotify authorization in browser
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      throw Exception('Could not launch Spotify authorization');
    }
  }

  /// Listen for deep link callback
  Stream<Uri> getDeepLinkStream() {
    return _appLinks.uriLinkStream;
  }

  /// Handle deep link callback from Spotify
  Future<Map<String, dynamic>> handleCallback(Uri uri) async {
    // Extract code and state from callback URL
    final code = uri.queryParameters['code'];
    final state = uri.queryParameters['state'];
    final error = uri.queryParameters['error'];

    if (error != null) {
      throw Exception('Spotify authorization failed: $error');
    }

    if (code == null) {
      throw Exception('No authorization code received');
    }

    // Verify state matches (CSRF protection)
    if (state != _state) {
      throw Exception('State mismatch - possible CSRF attack');
    }

    // Exchange code for tokens via backend
    final result = await _apiService.exchangeCode(
      code: code,
      redirectUri: ApiConfig.spotifyRedirectUri,
      codeVerifier: _codeVerifier,
      target: 'mobile',
    );

    // Clear PKCE parameters
    _codeVerifier = null;
    _state = null;

    return result;
  }

  /// Get initial deep link (if app was launched via deep link)
  Future<Uri?> getInitialLink() async {
    try {
      return await _appLinks.getInitialLink();
    } catch (e) {
      print('Error getting initial link: $e');
      return null;
    }
  }
}
