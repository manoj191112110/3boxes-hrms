import 'package:flutter/material.dart';
import '../models/notification.dart';
import '../services/api_service.dart';

class NotificationProvider extends ChangeNotifier {
  List<NotificationModel> _notifications = [];
  bool _isLoading = false;
  String? _error;
  int _unreadCount = 0;

  List<NotificationModel> get notifications => _notifications;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get unreadCount => _unreadCount;

  Future<void> fetchNotifications() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ApiService.getNotifications();
      List<NotificationModel> loadedNotifications = [];
      if (response.containsKey('data')) {
        final data = response['data'];
        if (data is List) {
          loadedNotifications = data.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
        } else if (data is Map<String, dynamic> && data.containsKey('notifications')) {
          final list = data['notifications'];
          if (list is List) {
            loadedNotifications = list.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
          }
        }
      } else if (response.containsKey('notifications')) {
        final list = response['notifications'];
        if (list is List) {
          loadedNotifications = list.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
      _notifications = loadedNotifications;
      _calculateUnreadCount();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
  }

  void _calculateUnreadCount() {
    _unreadCount = _notifications.where((n) => !n.isRead).length;
  }

  void markAsRead(String id) {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      final old = _notifications[index];
      _notifications[index] = NotificationModel(
        id: old.id, title: old.title, message: old.message,
        type: old.type, isRead: true, createdAt: old.createdAt,
      );
      _calculateUnreadCount();
      notifyListeners();
    }
  }

  void markAllAsRead() {
    _notifications = _notifications.map((n) => NotificationModel(
      id: n.id, title: n.title, message: n.message,
      type: n.type, isRead: true, createdAt: n.createdAt,
    )).toList();
    _unreadCount = 0;
    notifyListeners();
  }

  void clearAll() {
    _notifications = [];
    _unreadCount = 0;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
