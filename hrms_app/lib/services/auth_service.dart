import '../models/user.dart';
import 'api_service.dart';
import 'storage_service.dart';

class AuthService {
  Future<Map<String, dynamic>> login(String email, String password, {bool rememberMe = false}) async {
    try {
      final response = await ApiService.login(email, password);

      if (rememberMe) {
        await StorageService.setRememberMe(true);
        await StorageService.setRememberedEmail(email);
      } else {
        await StorageService.setRememberMe(false);
      }

      return response;
    } catch (e) {
      rethrow;
    }
  }

  bool isLoggedIn() {
    return StorageService.isLoggedIn;
  }

  Future<UserModel?> getCurrentUser() async {
    return await ApiService.getStoredUser();
  }

  String? getToken() {
    return StorageService.getToken();
  }

  Future<void> logout() async {
    await StorageService.clearAll();
    ApiService.clearToken();
  }

  bool isRememberMe() {
    return StorageService.getRememberMe();
  }

  String? getSavedEmail() {
    return StorageService.getRememberedEmail();
  }
}
