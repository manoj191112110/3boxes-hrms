import 'package:flutter/material.dart';
import '../models/employee.dart';
import '../services/api_service.dart';

class EmployeeProvider extends ChangeNotifier {
  List<EmployeeModel> _employees = [];
  bool _isLoading = false;
  String? _error;
  int _currentPage = 1;
  bool _hasMore = true;
  String _searchQuery = '';
  String _statusFilter = '';

  List<EmployeeModel> get employees => _employees;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasMore => _hasMore;
  String get searchQuery => _searchQuery;
  String get statusFilter => _statusFilter;

  Future<void> fetchEmployees({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
      _employees = [];
    }
    if (!_hasMore || _isLoading) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.getEmployees(
        page: _currentPage,
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
        status: _statusFilter.isNotEmpty ? _statusFilter : null,
      );
      final List items = data['employees'] ?? data['data'] ?? data['items'] ?? [];
      final newEmployees = items.map((e) => EmployeeModel.fromJson(e)).toList();

      if (refresh) {
        _employees = newEmployees;
      } else {
        _employees.addAll(newEmployees);
      }
      _hasMore = newEmployees.length >= 20;
      _currentPage++;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
  }

  void setSearch(String query) {
    _searchQuery = query;
    fetchEmployees(refresh: true);
  }

  void setStatusFilter(String status) {
    _statusFilter = status;
    fetchEmployees(refresh: true);
  }

  Future<EmployeeModel?> getEmployeeDetail(String id) async {
    try {
      final data = await ApiService.getEmployeeDetail(id);
      return EmployeeModel.fromJson(data['employee'] ?? data);
    } catch (e) {
      return null;
    }
  }
}
