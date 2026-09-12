import 'package:flutter/material.dart';
import '../config/colors.dart';
import '../models/attendance.dart';

class AttendanceCard extends StatelessWidget {
  final AttendanceModel attendance;
  final VoidCallback? onTap;

  const AttendanceCard({super.key, required this.attendance, this.onTap});

  Color get _statusColor {
    if (attendance.isPresent) return AppColors.success;
    if (attendance.isAbsent) return AppColors.error;
    if (attendance.isOnLeave) return AppColors.warning;
    if (attendance.isHalfDay) return AppColors.accent;
    return AppColors.primary;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  attendance.isPresent ? Icons.check_circle : (attendance.isAbsent ? Icons.cancel : Icons.access_time),
                  color: _statusColor, size: 22,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (attendance.employeeName != null)
                      Text(attendance.employeeName!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text('In: ${attendance.checkInTime}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(width: 12),
                        Text('Out: ${attendance.checkOutTime}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: _statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(attendance.status, style: TextStyle(color: _statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
