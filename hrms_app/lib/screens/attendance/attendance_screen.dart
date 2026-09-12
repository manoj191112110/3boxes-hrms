import 'package:flutter/material.dart';
import '../../config/colors.dart';
import 'package:intl/intl.dart';

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Month header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(gradient: AppColors.headerGradient),
              child: Column(
                children: [
                  Text(DateFormat('MMMM yyyy').format(now), style: const TextStyle(
                    color: Colors.white, fontSize: 20, fontWeight: FontWeight.w600,
                  )),
                  const SizedBox(height: 8),
                  const Text('Attendance Overview', style: TextStyle(
                    color: Colors.white70, fontSize: 14,
                  )),
                ],
              ),
            ),
            // Today's Status
            Padding(
              padding: const EdgeInsets.all(16),
              child: _buildTodayStatus(),
            ),
            const SizedBox(height: 8),
            // Monthly Summary
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildMonthlySummary(),
            ),
            const SizedBox(height: 16),
            // Recent Records
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildAttendanceList(),
            ),
            const SizedBox(height: 100),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        icon: const Icon(Icons.login),
        label: const Text('Check In'),
        backgroundColor: AppColors.success,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildTodayStatus() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Today's Status", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Row(
              children: [
                _statusItem(Icons.login, 'Check In', '09:00 AM', AppColors.success),
                const SizedBox(width: 16),
                _statusItem(Icons.logout, 'Check Out', '06:00 PM', AppColors.primary),
                const SizedBox(width: 16),
                _statusItem(Icons.schedule, 'Total Hours', '9.0 hrs', AppColors.secondary),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusItem(IconData icon, String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(color: color.withValues(alpha: 0.7), fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _buildMonthlySummary() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Monthly Summary', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(children: [
              _summaryChip('Present', '22', AppColors.success),
              _summaryChip('Absent', '1', AppColors.error),
              _summaryChip('Leaves', '2', AppColors.warning),
              _summaryChip('Late', '1', AppColors.secondary),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _summaryChip(String label, String value, Color color) {
    return Expanded(
      child: Column(children: [
        Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w700)),
        Text(label, style: const TextStyle(color: AppColors.textTertiary, fontSize: 11)),
      ]),
    );
  }

  Widget _buildAttendanceList() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent Records', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            _recordRow('Today', '09:00 AM', '06:00 PM', '9.0 hrs', AppColors.success),
            _recordRow('Yesterday', '09:15 AM', '06:30 PM', '9.25 hrs', AppColors.success),
            _recordRow('2 days ago', '09:00 AM', '--:--', 'In Progress', AppColors.primary),
          ],
        ),
      ),
    );
  }

  Widget _recordRow(String date, String checkIn, String checkOut, String hours, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Expanded(child: Text(date, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
          Text(checkIn, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(width: 12),
          Text(checkOut, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(width: 12),
          Text(hours, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
