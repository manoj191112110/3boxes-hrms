class UserModel {
  final String id;
  final String email;
  final String name;
  final String? avatar;
  final String? role;
  final String? tenantId;
  final String? tenantSlug;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.avatar,
    this.role,
    this.tenantId,
    this.tenantSlug,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? json['firstName'] ?? '',
      avatar: json['avatar'] ?? json['profileImage'],
      role: json['role'] ?? json['roleName'],
      tenantId: json['tenantId'],
      tenantSlug: json['tenantSlug'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'avatar': avatar,
        'role': role,
        'tenantId': tenantId,
        'tenantSlug': tenantSlug,
      };

  String get displayName => name.isNotEmpty ? name : email.split('@').first;
  String get initials {
    final parts = displayName.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return displayName.isNotEmpty ? displayName[0].toUpperCase() : '?';
  }
}
