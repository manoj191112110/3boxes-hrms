import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/user.dart';
import 'storage_service.dart';

class ApiService {
  static String? _token;

  static void setToken(String token) => _token = token;
  static String? get token => _token;
  static void clearToken() => _token = null;

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static Future<http.Response> _get(String url, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse(url).replace(queryParameters: queryParams);
    return http.get(uri, headers: _headers).timeout(ApiConfig.timeout);
  }

  static Future<http.Response> _post(String url, Map<String, dynamic> body) async {
    return http.post(Uri.parse(url), headers: _headers, body: jsonEncode(body)).timeout(ApiConfig.timeout);
  }

  static Future<http.Response> _put(String url, Map<String, dynamic> body) async {
    return http.put(Uri.parse(url), headers: _headers, body: jsonEncode(body)).timeout(ApiConfig.timeout);
  }

  static Future<http.Response> _delete(String url) async {
    return http.delete(Uri.parse(url), headers: _headers).timeout(ApiConfig.timeout);
  }

  // ============ Auth ============
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _post(ApiConfig.login, {'email': email, 'password': password});
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      final token = data['token'] ?? data['data']?['token'];
      if (token != null) {
        setToken(token);
        await StorageService.setToken(token);
        final userJson = data['user'] ?? data['data']?['user'] ?? data['data'];
        if (userJson != null) {
          final userStr = jsonEncode(userJson);
          await StorageService.setUserData(userStr);
        }
      }
      return data;
    }
    throw Exception(data['error'] ?? data['message'] ?? 'Login failed');
  }

  static Future<UserModel?> getStoredUser() async {
    final data = StorageService.getUserData();
    if (data == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(data));
    } catch (_) {
      return null;
    }
  }

  static Future<void> logout() async {
    clearToken();
    await StorageService.clearAll();
  }

  // ============ Dashboard ============
  static Future<Map<String, dynamic>> getDashboard() async {
    final response = await _get(ApiConfig.dashboard);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['data'] ?? data;
    throw Exception(data['error'] ?? 'Failed to load dashboard');
  }

  // ============ Employees ============
  static Future<Map<String, dynamic>> getEmployees({int page = 1, int limit = 20, String? search, String? status}) async {
    final params = <String, String>{'page': '$page', 'limit': '$limit'};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (status != null) params['status'] = status;
    final response = await _get(ApiConfig.employees, queryParams: params);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to load employees');
  }

  static Future<Map<String, dynamic>> getEmployeeDetail(String id) async {
    final response = await _get(ApiConfig.employeeDetail(id));
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['data'] ?? data;
    throw Exception(data['error'] ?? 'Failed to load employee');
  }

  // ============ Leaves ============
  static Future<Map<String, dynamic>> getLeaves({int page = 1, String? status}) async {
    final params = <String, String>{'page': '$page'};
    if (status != null) params['status'] = status;
    final response = await _get(ApiConfig.leaves, queryParams: params);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to load leaves');
  }

  static Future<Map<String, dynamic>> createLeave(Map<String, dynamic> leaveData) async {
    final response = await _post(ApiConfig.leaves, leaveData);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) return data;
    throw Exception(data['error'] ?? data['message'] ?? 'Failed to create leave');
  }

  // ============ Attendance ============
  static Future<Map<String, dynamic>> getAttendance({String? date, int? month, int? year}) async {
    final params = <String, String>{};
    if (date != null) params['date'] = date;
    if (month != null) params['month'] = '$month';
    if (year != null) params['year'] = '$year';
    final response = await _get(ApiConfig.attendance, queryParams: params);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to load attendance');
  }

  // ============ Companies ============
  static Future<Map<String, dynamic>> getCompanies() async {
    final response = await _get(ApiConfig.companies);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to load companies');
  }

  // ============ Reports ============
  static Future<Map<String, dynamic>> exportReport(String reportType, String format, {String? startDate, String? endDate}) async {
    final params = <String, String>{'type': reportType, 'format': format};
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;
    final response = await _get(ApiConfig.reportsExport, queryParams: params);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to export report');
  }

  // ============ Tenant Config ============
  static Future<Map<String, dynamic>> getTenantConfiguration() async {
    final response = await _get(ApiConfig.tenantConfiguration);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['data'] ?? data;
    throw Exception(data['error'] ?? 'Failed to load configuration');
  }

  // ============ Notifications ============
  static Future<Map<String, dynamic>> getNotifications() async {
    final response = await _get(ApiConfig.notifications);
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to load notifications');
  }
}
