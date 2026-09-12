import 'package:flutter/material.dart';
import '../models/attendance.dart';
import '../services/api_service.dart';

class AttendanceProvider extends ChangeNotifier {
  List<AttendanceModel> _attendanceRecords = [];
  bool _isLoading = false;
  String? _error;
  DateTime _selectedDate = DateTime.now();
  Map<String, List<AttendanceModel>> _attendanceByDate = {};

  List<AttendanceModel> get attendanceRecords => _attendanceRecords;
  bool get isLoading => _isLoading;
  String? get error => _error;
  DateTime get selectedDate => _selectedDate;

  List<AttendanceModel>? getAttendanceForDate(DateTime date) {
    final key = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    return _attendanceByDate[key];
  }

  int get presentCount => _attendanceRecords.where((a) => a.isPresent).length;
  int get absentCount => _attendanceRecords.where((a) => a.isAbsent).length;
  int get leaveCount => _attendanceRecords.where((a) => a.isOnLeave).length;
  int get lateCount => _attendanceRecords.where((a) => a.status.toLowerCase() == 'late').length;

  Future<void> fetchAttendance({String? date, bool refresh = true}) async {
    _isLoading = true;
    _error = null;
    if (refresh) _attendanceRecords = [];
    notifyListeners();

    try {
      final response = await ApiService.getAttendance(date: date);
      List<AttendanceModel> loadedRecords = [];
      if (response.containsKey('data')) {
        final data = response['data'];
        if (data is List) {
          loadedRecords = data.map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>)).toList();
        } else if (data is Map<String, dynamic> && data.containsKey('records')) {
          final list = data['records'];
          if (list is List) loadedRecords = list.map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>)).toList();
        }
      } else if (response.containsKey('records')) {
        final list = response['records'];
        if (list is List) loadedRecords = list.map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (response.containsKey('attendance')) {
        final list = response['attendance'];
        if (list is List) loadedRecords = list.map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      _attendanceRecords = loadedRecords;
      _organizeByDate();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
  }

  void _organizeByDate() {
    _attendanceByDate.clear();
    for (final record in _attendanceRecords) {
      final key = '${record.date.year}-${record.date.month.toString().padLeft(2, '0')}-${record.date.day.toString().padLeft(2, '0')}';
      _attendanceByDate.putIfAbsent(key, () => []).add(record);
    }
  }

  void setSelectedDate(DateTime date) {
    _selectedDate = date;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
