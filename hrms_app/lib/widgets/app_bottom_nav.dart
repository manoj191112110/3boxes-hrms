import 'package:flutter/material.dart';
import '../config/colors.dart';

class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const AppBottomNav({super.key, required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, -2))],
      ),
      child: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: onTap,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textTertiary,
        backgroundColor: Colors.transparent,
        elevation: 0,
        selectedFontSize: 12,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined, size: 22), activeIcon: Icon(Icons.dashboard, size: 24), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outlined, size: 22), activeIcon: Icon(Icons.people, size: 24), label: 'Employees'),
          BottomNavigationBarItem(icon: Icon(Icons.event_note_outlined, size: 22), activeIcon: Icon(Icons.event_note, size: 24), label: 'Leaves'),
          BottomNavigationBarItem(icon: Icon(Icons.access_time_outlined, size: 22), activeIcon: Icon(Icons.access_time, size: 24), label: 'Attendance'),
          BottomNavigationBarItem(icon: Icon(Icons.assessment_outlined, size: 22), activeIcon: Icon(Icons.assessment, size: 24), label: 'Reports'),
        ],
      ),
    );
  }
}
