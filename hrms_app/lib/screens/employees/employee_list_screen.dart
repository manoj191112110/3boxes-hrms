import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/colors.dart';
import '../../providers/employee_provider.dart';
import '../../models/employee.dart';
import '../../widgets/employee_card.dart';
import '../../widgets/loading_widget.dart';
import '../../widgets/empty_state_widget.dart';

class EmployeeListScreen extends StatefulWidget {
  const EmployeeListScreen({super.key});

  @override
  State<EmployeeListScreen> createState() => _EmployeeListScreenState();
}

class _EmployeeListScreenState extends State<EmployeeListScreen> {
  final _searchController = TextEditingController();
  String _statusFilter = '';
  final List<String> _filters = ['', 'ACTIVE', 'INACTIVE', 'ON_PROBATION'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EmployeeProvider>().fetchEmployees(refresh: true);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<EmployeeProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Employees'),
        actions: [
          IconButton(icon: const Icon(Icons.filter_list), onPressed: () => _showFilterSheet(context)),
        ],
      ),
      body: Column(
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search employees...',
                prefixIcon: const Icon(Icons.search, color: AppColors.textTertiary),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.clear), onPressed: () {
                        _searchController.clear();
                        context.read<EmployeeProvider>().setSearch('');
                      })
                    : null,
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (v) => context.read<EmployeeProvider>().setSearch(v),
            ),
          ),
          // Filter chips
          if (_statusFilter.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Chip(
                  label: Text(_statusFilter),
                  onDeleted: () {
                    setState(() => _statusFilter = '');
                    context.read<EmployeeProvider>().setStatusFilter('');
                  },
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  labelStyle: const TextStyle(color: AppColors.primary, fontSize: 12),
                ),
              ),
            ),
          // List
          Expanded(
            child: _buildList(provider),
          ),
        ],
      ),
    );
  }

  Widget _buildList(EmployeeProvider provider) {
    if (provider.isLoading && provider.employees.isEmpty) {
      return const LoadingWidget(itemCount: 8);
    }
    if (provider.error != null && provider.employees.isEmpty) {
      return EmptyStateWidget(
        icon: Icons.error_outline,
        title: 'Error',
        message: provider.error,
        actionLabel: 'Retry',
        onAction: () => provider.fetchEmployees(refresh: true),
      );
    }
    if (provider.employees.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.people_outline,
        title: 'No Employees Found',
        message: 'There are no employees matching your criteria',
      );
    }

    return RefreshIndicator(
      onRefresh: () => provider.fetchEmployees(refresh: true),
      child: ListView.builder(
        itemCount: provider.employees.length + (provider.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == provider.employees.length) {
            provider.fetchEmployees();
            return const Center(child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ));
          }
          final emp = provider.employees[index];
          return EmployeeCard(
            employee: emp,
            onTap: () => Navigator.pushNamed(context, '/employees/detail', arguments: emp),
          );
        },
      ),
    );
  }

  void _showFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Filter by Status', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: _filters.map((f) => ChoiceChip(
                label: Text(f.isEmpty ? 'All' : f),
                selected: _statusFilter == f,
                onSelected: (_) {
                  setState(() => _statusFilter = f);
                  context.read<EmployeeProvider>().setStatusFilter(f);
                  Navigator.pop(ctx);
                },
                selectedColor: AppColors.primary.withValues(alpha: 0.1),
                labelStyle: TextStyle(
                  color: _statusFilter == f ? AppColors.primary : AppColors.textSecondary,
                  fontWeight: _statusFilter == f ? FontWeight.w600 : FontWeight.normal,
                ),
              )).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
