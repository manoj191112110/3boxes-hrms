import 'package:flutter/material.dart';
import '../config/colors.dart';
import '../models/employee.dart';

class EmployeeCard extends StatelessWidget {
  final EmployeeModel employee;
  final VoidCallback? onTap;

  const EmployeeCard({super.key, required this.employee, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _buildAvatar(),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(employee.fullName, style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
                    )),
                    if (employee.designation != null) ...[
                      const SizedBox(height: 2),
                      Text(employee.designation!, style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary,
                      )),
                    ],
                    if (employee.department != null) ...[
                      const SizedBox(height: 2),
                      Text(employee.department!, style: const TextStyle(
                        fontSize: 12, color: AppColors.textTertiary,
                      )),
                    ],
                  ],
                ),
              ),
              _buildStatusBadge(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 48, height: 48,
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Text(employee.initials, style: const TextStyle(
          color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600,
        )),
      ),
    );
  }

  Widget _buildStatusBadge() {
    Color color;
    String label;
    if (employee.isOnProbation) {
      color = AppColors.warning;
      label = 'Probation';
    } else if (employee.isActive) {
      color = AppColors.success;
      label = 'Active';
    } else {
      color = AppColors.error;
      label = 'Inactive';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
