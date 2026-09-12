import 'package:flutter/material.dart';
import '../config/colors.dart';
import '../models/leave.dart';
import 'package:intl/intl.dart';

class LeaveCard extends StatelessWidget {
  final LeaveModel leave;
  final VoidCallback? onTap;

  const LeaveCard({super.key, required this.leave, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _getTypeColor().withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.event_note, color: _getTypeColor(), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(leave.leaveType, style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
                        )),
                        Text(leave.durationText, style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary,
                        )),
                      ],
                    ),
                  ),
                  _buildStatusBadge(),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text(
                    '${DateFormat('dd MMM').format(leave.startDate)} - ${DateFormat('dd MMM yyyy').format(leave.endDate)}',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
              if (leave.reason != null && leave.reason!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(leave.reason!, style: const TextStyle(
                  fontSize: 13, color: AppColors.textTertiary,
                ), maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getTypeColor() {
    switch (leave.leaveType.toLowerCase()) {
      case 'sick leave': return AppColors.error;
      case 'casual leave': return AppColors.primary;
      case 'earned leave': return AppColors.success;
      case 'maternity leave': return AppColors.secondary;
      default: return AppColors.primary;
    }
  }

  Widget _buildStatusBadge() {
    Color color;
    if (leave.isPending) color = AppColors.warning;
    else if (leave.isApproved) color = AppColors.success;
    else color = AppColors.error;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(leave.status.toUpperCase(), style: TextStyle(
        color: color, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5,
      )),
    );
  }
}
