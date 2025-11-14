/// User Model - Represents authenticated user
class User {
  final String id;
  final String spotifyId;
  final String displayName;
  final String? email;
  final String? imageUrl;

  User({
    required this.id,
    required this.spotifyId,
    required this.displayName,
    this.email,
    this.imageUrl,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? json['id'] ?? '',
      spotifyId: json['spotifyId'] ?? '',
      displayName: json['displayName'] ?? '',
      email: json['email'],
      imageUrl: json['imageUrl'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'spotifyId': spotifyId,
        'displayName': displayName,
        'email': email,
        'imageUrl': imageUrl,
      };
}
