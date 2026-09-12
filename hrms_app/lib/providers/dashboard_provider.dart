import 'package:flutter/material.dart';
import '../models/dashboard_stats.dart';
import '../services/api_service.dart';

class DashboardProvider extends ChangeNotifier {
  DashboardStats? _stats;
  bool _isLoading = false;
  String? _error;

  DashboardStats? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.getDashboard();
      _stats = DashboardStats.fromJson(data);
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
  }
}
