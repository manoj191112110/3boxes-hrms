import 'package:flutter/material.dart';
import '../services/storage_service.dart';

class ThemeProvider extends ChangeNotifier {
  bool _isDarkMode = false;

  bool get isDarkMode => _isDarkMode;

  ThemeProvider() {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final saved = StorageService.getString('theme_mode');
    _isDarkMode = saved == 'dark';
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    await StorageService.setString('theme_mode', _isDarkMode ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _isDarkMode = value;
    await StorageService.setString('theme_mode', _isDarkMode ? 'dark' : 'light');
    notifyListeners();
  }
}
