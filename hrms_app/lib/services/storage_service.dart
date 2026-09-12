import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  static SharedPreferences get prefs {
    if (_prefs == null) throw Exception('StorageService not initialized');
    return _prefs!;
  }

  // Token
  static Future<void> setToken(String token) async => await prefs.setString('auth_token', token);
  static String? getToken() => prefs.getString('auth_token');
  static Future<void> removeToken() async => await prefs.remove('auth_token');

  // User data
  static Future<void> setUserData(String data) async => await prefs.setString('user_data', data);
  static String? getUserData() => prefs.getString('user_data');
  static Future<void> removeUserData() async => await prefs.remove('user_data');

  // Remember me
  static Future<void> setRememberMe(bool value) async => await prefs.setBool('remember_me', value);
  static bool getRememberMe() => prefs.getBool('remember_me') ?? false;
  static Future<void> setRememberedEmail(String email) async => await prefs.setString('remembered_email', email);
  static String? getRememberedEmail() => prefs.getString('remembered_email');

  // Theme
  static Future<void> setThemeMode(String mode) async => await prefs.setString('theme_mode', mode);
  static String getThemeMode() => prefs.getString('theme_mode') ?? 'light';

  // Notifications
  static Future<void> setFcmToken(String token) async => await prefs.setString('fcm_token', token);
  static String? getFcmToken() => prefs.getString('fcm_token');

  // Clear all
  static Future<void> clearAll() async {
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
    await prefs.remove('remember_me');
    await prefs.remove('remembered_email');
  }

  static bool get isLoggedIn => getToken() != null;
}
