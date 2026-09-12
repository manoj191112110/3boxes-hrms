import 'package:flutter/material.dart';
import '../../config/colors.dart';
import '../../models/employee.dart';
import 'package:intl/intl.dart';

class EmployeeDetailScreen extends StatelessWidget {
  final EmployeeModel employee;

  const EmployeeDetailScreen({super.key, required this.employee});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Header
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(gradient: AppColors.headerGradient),
                child: SafeArea(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          width: 80, height: 80,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Center(
                            child: Text(employee.initials, style: const TextStyle(
                              color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700,
                            )),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(employee.fullName, style: const TextStyle(
                          color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700,
                        )),
                        if (employee.designation != null)
                          Text(employee.designation!, style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8), fontSize: 14,
                          )),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status badge
                  _buildStatusSection(),
                  const SizedBox(height: 16),
                  // Contact Info
                  _buildSection('Contact Information', [
                    _infoRow(Icons.email, 'Email', employee.email ?? 'N/A'),
                    _infoRow(Icons.phone, 'Phone', employee.phone ?? 'N/A'),
                    _infoRow(Icons.wc, 'Gender', employee.gender ?? 'N/A'),
                  ]),
                  const SizedBox(height: 16),
                  // Employment Info
                  _buildSection('Employment Details', [
                    _infoRow(Icons.badge, 'Employee Code', employee.employeeCode ?? 'N/A'),
                    _infoRow(Icons.business, 'Department', employee.department ?? 'N/A'),
                    _infoRow(Icons.work, 'Designation', employee.designation ?? 'N/A'),
                    _infoRow(Icons.location_city, 'Branch', employee.branch ?? 'N/A'),
                    _infoRow(Icons.person, 'Reporting Manager', employee.reportingManager ?? 'N/A'),
                    _infoRow(Icons.calendar_today, 'Join Date', employee.joinDate != null
                        ? DateFormat('dd MMM yyyy').format(employee.joinDate!) : 'N/A'),
                  ]),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusSection() {
    Color color = employee.isActive ? AppColors.success : (employee.isOnProbation ? AppColors.warning : AppColors.error);
    String label = employee.isActive ? 'Active' : (employee.isOnProbation ? 'On Probation' : 'Inactive');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.circle, color: color, size: 12),
          const SizedBox(width: 8),
          Text('Status: $label', style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textTertiary),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const Spacer(),
          Flexible(
            child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
              textAlign: TextAlign.right, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}
