import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/colors.dart';
import '../../providers/leave_provider.dart';
import '../../models/leave.dart';
import '../../widgets/leave_card.dart';
import '../../widgets/loading_widget.dart';
import '../../widgets/empty_state_widget.dart';

class LeaveListScreen extends StatefulWidget {
  const LeaveListScreen({super.key});

  @override
  State<LeaveListScreen> createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LeaveProvider>().fetchLeaves();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeaveProvider>();
    final summary = provider.summary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leaves'),
      ),
      body: Column(
        children: [
          // Summary cards
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _summaryCard('Total', '${summary['total']}', AppColors.primary),
                const SizedBox(width: 8),
                _summaryCard('Approved', '${summary['approved']}', AppColors.success),
                const SizedBox(width: 8),
                _summaryCard('Pending', '${summary['pending']}', AppColors.warning),
                const SizedBox(width: 8),
                _summaryCard('Rejected', '${summary['rejected']}', AppColors.error),
              ],
            ),
          ),
          // Filter tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _filterChip('All', '', provider),
                const SizedBox(width: 8),
                _filterChip('Pending', 'PENDING', provider),
                const SizedBox(width: 8),
                _filterChip('Approved', 'APPROVED', provider),
                const SizedBox(width: 8),
                _filterChip('Rejected', 'REJECTED', provider),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Leave list
          Expanded(child: _buildList(provider)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/leaves/request'),
        icon: const Icon(Icons.add),
        label: const Text('Apply Leave'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w700)),
            Text(label, style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String label, String value, LeaveProvider provider) {
    final isSelected = provider.statusFilter == value;
    return GestureDetector(
      onTap: () => provider.setStatusFilter(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
        ),
        child: Text(label, style: TextStyle(
          color: isSelected ? Colors.white : AppColors.textSecondary,
          fontSize: 13, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        )),
      ),
    );
  }

  Widget _buildList(LeaveProvider provider) {
    if (provider.isLoading) return const LoadingWidget(itemCount: 6);
    if (provider.error != null) {
      return EmptyStateWidget(
        icon: Icons.error_outline,
        title: 'Error',
        message: provider.error,
        actionLabel: 'Retry',
        onAction: () => provider.fetchLeaves(),
      );
    }
    if (provider.leaves.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.event_note,
        title: 'No Leaves Found',
        message: 'No leave records match your filter',
      );
    }
    return RefreshIndicator(
      onRefresh: () => provider.fetchLeaves(),
      child: ListView.builder(
        itemCount: provider.leaves.length,
        itemBuilder: (context, index) => LeaveCard(leave: provider.leaves[index]),
      ),
    );
  }
}
