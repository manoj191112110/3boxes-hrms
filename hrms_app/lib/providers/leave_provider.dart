import 'package:flutter/material.dart';
import '../models/leave.dart';
import '../services/api_service.dart';

class LeaveProvider extends ChangeNotifier {
  List<LeaveModel> _leaves = [];
  bool _isLoading = false;
  bool _isSubmitting = false;
  String? _error;
  String _statusFilter = '';
  Map<String, int> _summary = {'total': 0, 'approved': 0, 'pending': 0, 'rejected': 0};

  List<LeaveModel> get leaves => _leaves;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  String? get error => _error;
  String get statusFilter => _statusFilter;
  Map<String, int> get summary => _summary;

  Future<void> fetchLeaves({bool refresh = true}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.getLeaves(status: _statusFilter.isNotEmpty ? _statusFilter : null);
      final List items = data['leaves'] ?? data['data'] ?? data['items'] ?? [];
      _leaves = items.map((e) => LeaveModel.fromJson(e)).toList();
      _updateSummary();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
  }

  void _updateSummary() {
    _summary = {
      'total': _leaves.length,
      'approved': _leaves.where((l) => l.isApproved).length,
      'pending': _leaves.where((l) => l.isPending).length,
      'rejected': _leaves.where((l) => l.isRejected).length,
    };
  }

  void setStatusFilter(String status) {
    _statusFilter = status;
    fetchLeaves();
  }

  Future<bool> createLeave(Map<String, dynamic> leaveData) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.createLeave(leaveData);
      _isSubmitting = false;
      fetchLeaves();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }
}
