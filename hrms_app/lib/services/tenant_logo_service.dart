import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

/// Service to manage tenant-specific logos.
///
/// - For the demo tenant (3boxes-hrms-demo), returns the 3Boxes HRMS logo.
/// - For tenant logins, fetches the tenant's logo URL from the API.
/// - Caches tenant logo info in SharedPreferences for offline use.
class TenantLogoService {
  // Local asset paths
  static const String _3boxesLogoAsset = 'assets/logos/logo-3boxes.png';
  static const String _companyDefaultAsset = 'assets/logos/company-default.png';

  // SharedPreferences keys
  static const String _keyTenantSlug = 'tenant_logo_slug';
  static const String _keyTenantName = 'tenant_logo_name';
  static const String _keyTenantLogoUrl = 'tenant_logo_url';
  static const String _keyTenantLogoIsAsset = 'tenant_logo_is_asset';

  // Cached in-memory values
  static String? _cachedSlug;
  static String? _cachedTenantName;
  static String? _cachedLogoUrl;
  static bool? _cachedIsAsset;

  /// Returns the local asset path for the 3Boxes HRMS logo.
  static String get threeBoxesLogo => _3boxesLogoAsset;

  /// Returns the local asset path for the default company logo.
  static String get companyDefaultLogo => _companyDefaultAsset;

  /// Returns true if the given slug is the demo tenant.
  static bool isDemoTenant(String? slug) {
    return slug == null || slug.isEmpty || slug == ApiConfig.tenantSlug;
  }

  /// Fetches tenant info from the API and caches the logo information.
  ///
  /// Returns a [TenantLogoInfo] with the appropriate logo details.
  static Future<TenantLogoInfo> fetchTenantLogo(String slug) async {
    // If demo tenant, return 3Boxes logo immediately
    if (isDemoTenant(slug)) {
      final info = TenantLogoInfo(
        slug: slug,
        tenantName: '3Boxes HRMS Demo',
        logoPath: _3boxesLogoAsset,
        isAsset: true,
      );
      await _cacheLogoInfo(info);
      ApiConfig.setActiveTenantSlug(slug);
      _updateMemoryCache(info);
      return info;
    }

    // Try to fetch tenant info from the API
    try {
      final url = ApiConfig.tenantInfo(slug);
      final response = await http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final tenantData = data['data'] ?? data;
        final tenantName = tenantData['name'] as String? ??
            tenantData['companyName'] as String? ??
            slug;
        final logoUrl = tenantData['logo'] as String? ??
            tenantData['companyLogo'] as String? ??
            tenantData['logoUrl'] as String?;

        final info = TenantLogoInfo(
          slug: slug,
          tenantName: tenantName,
          logoPath: logoUrl ?? _companyDefaultAsset,
          isAsset: logoUrl == null,
        );

        await _cacheLogoInfo(info);
        ApiConfig.setActiveTenantSlug(slug);
        _updateMemoryCache(info);
        return info;
      }
    } catch (e) {
      // API call failed; fall through to cached/default
    }

    // Try to load from cache
    final cached = await getCachedLogoInfo();
    if (cached != null && cached.slug == slug) {
      return cached;
    }

    // Fall back to default company logo
    final info = TenantLogoInfo(
      slug: slug,
      tenantName: slug,
      logoPath: _companyDefaultAsset,
      isAsset: true,
    );
    await _cacheLogoInfo(info);
    ApiConfig.setActiveTenantSlug(slug);
    _updateMemoryCache(info);
    return info;
  }

  /// Gets the cached tenant logo info from SharedPreferences.
  static Future<TenantLogoInfo?> getCachedLogoInfo() async {
    // Check in-memory cache first
    if (_cachedSlug != null) {
      return TenantLogoInfo(
        slug: _cachedSlug!,
        tenantName: _cachedTenantName ?? '',
        logoPath: _cachedLogoUrl ?? _3boxesLogoAsset,
        isAsset: _cachedIsAsset ?? true,
      );
    }

    final prefs = await SharedPreferences.getInstance();
    final slug = prefs.getString(_keyTenantSlug);
    if (slug == null) return null;

    final tenantName = prefs.getString(_keyTenantName) ?? '';
    final logoUrl = prefs.getString(_keyTenantLogoUrl) ?? _3boxesLogoAsset;
    final isAsset = prefs.getBool(_keyTenantLogoIsAsset) ?? true;

    final info = TenantLogoInfo(
      slug: slug,
      tenantName: tenantName,
      logoPath: logoUrl,
      isAsset: isAsset,
    );
    _updateMemoryCache(info);
    return info;
  }

  /// Gets the logo info to display based on current tenant context.
  ///
  /// Call this after login or on app startup to get the right logo.
  static Future<TenantLogoInfo> getCurrentLogo() async {
    final cached = await getCachedLogoInfo();
    if (cached != null) return cached;

    // Default to 3Boxes logo for demo
    return TenantLogoInfo(
      slug: ApiConfig.tenantSlug,
      tenantName: '3Boxes HRMS',
      logoPath: _3boxesLogoAsset,
      isAsset: true,
    );
  }

  /// Clears cached tenant logo info (call on logout).
  static Future<void> clearCache() async {
    _cachedSlug = null;
    _cachedTenantName = null;
    _cachedLogoUrl = null;
    _cachedIsAsset = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyTenantSlug);
    await prefs.remove(_keyTenantName);
    await prefs.remove(_keyTenantLogoUrl);
    await prefs.remove(_keyTenantLogoIsAsset);

    // Reset to demo tenant
    ApiConfig.setActiveTenantSlug(ApiConfig.tenantSlug);
  }

  // ---- Private helpers ----

  static Future<void> _cacheLogoInfo(TenantLogoInfo info) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyTenantSlug, info.slug);
    await prefs.setString(_keyTenantName, info.tenantName);
    await prefs.setString(_keyTenantLogoUrl, info.logoPath);
    await prefs.setBool(_keyTenantLogoIsAsset, info.isAsset);
  }

  static void _updateMemoryCache(TenantLogoInfo info) {
    _cachedSlug = info.slug;
    _cachedTenantName = info.tenantName;
    _cachedLogoUrl = info.logoPath;
    _cachedIsAsset = info.isAsset;
  }
}

/// Holds resolved logo information for a tenant.
class TenantLogoInfo {
  /// The tenant slug identifier.
  final String slug;

  /// Human-readable tenant/company name.
  final String tenantName;

  /// Path to the logo: either a local asset path (when [isAsset] is true)
  /// or a remote URL (when [isAsset] is false).
  final String logoPath;

  /// Whether [logoPath] refers to a local asset (true) or a network URL (false).
  final bool isAsset;

  const TenantLogoInfo({
    required this.slug,
    required this.tenantName,
    required this.logoPath,
    this.isAsset = true,
  });

  bool get isDemo => TenantLogoService.isDemoTenant(slug);

  @override
  String toString() =>
      'TenantLogoInfo(slug: $slug, name: $tenantName, path: $logoPath, isAsset: $isAsset)';
}
