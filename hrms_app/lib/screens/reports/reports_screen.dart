import 'package:flutter/material.dart';
import '../../config/colors.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _selectedFormat = 'PDF';
  final List<String> _formats = ['PDF', 'Excel', 'CSV'];

  final List<Map<String, dynamic>> _reportTypes = [
    {'icon': Icons.people, 'title': 'Headcount Report', 'type': 'headcount', 'color': AppColors.primary},
    {'icon': Icons.business, 'title': 'Department Report', 'type': 'department', 'color': AppColors.secondary},
    {'icon': Icons.pie_chart, 'title': 'Demographics Report', 'type': 'demographics', 'color': AppColors.success},
    {'icon': Icons.trending_down, 'title': 'Turnover Analysis', 'type': 'turnover', 'color': AppColors.error},
    {'icon': Icons.timeline, 'title': 'Attrition Report', 'type': 'attrition', 'color': AppColors.warning},
    {'icon': Icons.swap_horiz, 'title': 'Joiners & Leavers', 'type': 'joiners-leavers', 'color': AppColors.info},
    {'icon': Icons.hourglass_empty, 'title': 'Probation Report', 'type': 'probation', 'color': AppColors.primary},
    {'icon': Icons.login, 'title': 'Login Activity', 'type': 'login-activity', 'color': AppColors.secondary},
    {'icon': Icons.account_tree, 'title': 'Company Structure', 'type': 'company-structure', 'color': AppColors.success},
    {'icon': Icons.bar_chart, 'title': 'Headcount Distribution', 'type': 'headcount-distribution', 'color': AppColors.primary},
    {'icon': Icons.location_city, 'title': 'Branch Summary', 'type': 'branch-summary', 'color': AppColors.warning},
    {'icon': Icons.analytics, 'title': 'Department Analytics', 'type': 'department-analytics', 'color': AppColors.secondary},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: Column(
        children: [
          // Format selector
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Text('Export Format: ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                const SizedBox(width: 8),
                ..._formats.map((f) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f),
                    selected: _selectedFormat == f,
                    onSelected: (_) => setState(() => _selectedFormat = f),
                    selectedColor: AppColors.primary.withValues(alpha: 0.1),
                    labelStyle: TextStyle(
                      color: _selectedFormat == f ? AppColors.primary : AppColors.textSecondary,
                      fontWeight: _selectedFormat == f ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                )),
              ],
            ),
          ),
          // Report grid
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.1,
              ),
              itemCount: _reportTypes.length,
              itemBuilder: (context, index) => _buildReportCard(_reportTypes[index]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReportCard(Map<String, dynamic> report) {
    final color = report['color'] as Color;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _generateReport(report),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(report['icon'] as IconData, color: color, size: 24),
              ),
              const SizedBox(height: 12),
              Text(report['title'] as String, style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
              )),
              const SizedBox(height: 4),
              Text('$_selectedFormat format', style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
              const Spacer(),
              Row(
                children: [
                  Icon(Icons.download, size: 14, color: color),
                  const SizedBox(width: 4),
                  Text('Generate', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _generateReport(Map<String, dynamic> report) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Generating ${report['title']} as $_selectedFormat...'),
        backgroundColor: AppColors.primary,
      ),
    );
  }
}
