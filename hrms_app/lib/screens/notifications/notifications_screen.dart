import 'package:flutter/material.dart';
import '../../config/colors.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final notifications = [
      {'icon': Icons.event_note, 'title': 'Leave Approved', 'message': 'Your casual leave request for 15-16 Aug has been approved', 'time': '2 hours ago', 'color': AppColors.success, 'read': false},
      {'icon': Icons.person_add, 'title': 'New Employee', 'message': 'A new employee has been onboarded to the Engineering team', 'time': '4 hours ago', 'color': AppColors.primary, 'read': false},
      {'icon': Icons.access_time, 'title': 'Attendance Reminder', 'message': 'Please mark your attendance for today', 'time': '6 hours ago', 'color': AppColors.warning, 'read': true},
      {'icon': Icons.assessment, 'title': 'Report Ready', 'message': 'Monthly headcount report is ready for download', 'time': '1 day ago', 'color': AppColors.secondary, 'read': true},
      {'icon': Icons.event_note, 'title': 'Leave Request', 'message': 'You have a new leave request pending approval', 'time': '1 day ago', 'color': AppColors.warning, 'read': true},
      {'icon': Icons.celebration, 'title': 'Birthday Alert', 'message': "Tomorrow is Rahul's birthday! Don't forget to wish them.", 'time': '2 days ago', 'color': AppColors.accent, 'read': true},
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () {},
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: notifications.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final n = notifications[index];
          return Card(
            margin: EdgeInsets.zero,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {},
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: (n['color'] as Color).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(n['icon'] as IconData, color: n['color'] as Color, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(n['title'] as String, style: TextStyle(
                                  fontSize: 14, fontWeight: (n['read'] as bool) ? FontWeight.w500 : FontWeight.w700,
                                  color: AppColors.textPrimary,
                                )),
                              ),
                              if (!(n['read'] as bool))
                                Container(width: 8, height: 8, decoration: const BoxDecoration(
                                  color: AppColors.primary, shape: BoxShape.circle,
                                )),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(n['message'] as String, style: const TextStyle(
                            fontSize: 13, color: AppColors.textSecondary,
                          ), maxLines: 2, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 6),
                          Text(n['time'] as String, style: const TextStyle(
                            fontSize: 11, color: AppColors.textTertiary,
                          )),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
