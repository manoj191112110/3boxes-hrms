import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../config/colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/loading_widget.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DashboardProvider>().fetchDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final dash = context.watch<DashboardProvider>();
    final now = DateTime.now();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<DashboardProvider>().fetchDashboard(),
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // Header
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 24),
                decoration: const BoxDecoration(gradient: AppColors.headerGradient),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Good ${_getGreeting(now)}!', style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.8), fontSize: 14,
                              )),
                              const SizedBox(height: 4),
                              Text(auth.user?.displayName ?? 'User', style: const TextStyle(
                                color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700,
                              )),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.pushNamed(context, '/notifications'),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 24),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(DateFormat('EEEE, dd MMMM yyyy').format(now), style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7), fontSize: 13,
                    )),
                  ],
                ),
              ),
            ),
            // Stats
            SliverToBoxAdapter(
              child: Transform.translate(
                offset: const Offset(0, -20),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _buildStatsGrid(dash),
                ),
              ),
            ),
            // Quick Actions
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: _buildQuickActions(),
              ),
            ),
            // Recent Activity
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _buildRecentActivity(dash),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  String _getGreeting(DateTime now) {
    final hour = now.hour;
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }

  Widget _buildStatsGrid(DashboardProvider dash) {
    if (dash.isLoading) {
      return const LoadingWidget(itemCount: 4, isCard: false);
    }
    final stats = dash.stats;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.3,
      children: [
        StatCard(
          title: 'Total Employees',
          value: '${stats?.totalEmployees ?? 140}',
          icon: Icons.people,
          gradient: AppColors.cardGradient1,
        ),
        StatCard(
          title: 'Present Today',
          value: '${stats?.presentToday ?? 128}',
          icon: Icons.check_circle,
          gradient: AppColors.cardGradient2,
        ),
        StatCard(
          title: 'On Leave',
          value: '${stats?.onLeave ?? 12}',
          icon: Icons.event_note,
          gradient: AppColors.cardGradient3,
        ),
        StatCard(
          title: 'Open Positions',
          value: '${stats?.openPositions ?? 5}',
          icon: Icons.work_outline,
          gradient: AppColors.cardGradient4,
        ),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Quick Actions', style: TextStyle(
          fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
        )),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildActionItem(Icons.event_note, 'Apply Leave', AppColors.primary, () => Navigator.pushNamed(context, '/leaves/request')),
            _buildActionItem(Icons.access_time, 'Attendance', AppColors.success, () => Navigator.pushNamed(context, '/attendance')),
            _buildActionItem(Icons.people, 'Employees', AppColors.secondary, () => Navigator.pushNamed(context, '/employees')),
            _buildActionItem(Icons.assessment, 'Reports', AppColors.warning, () => Navigator.pushNamed(context, '/reports')),
          ],
        ),
      ],
    );
  }

  Widget _buildActionItem(IconData icon, String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecentActivity(DashboardProvider dash) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Recent Activity', style: TextStyle(
          fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
        )),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildActivityItem(Icons.person_add, 'New employee onboarded', '2 hours ago', AppColors.success),
                _buildActivityItem(Icons.event_note, 'Leave request approved', '4 hours ago', AppColors.primary),
                _buildActivityItem(Icons.access_time, 'Attendance marked', 'Today 09:00 AM', AppColors.secondary),
                _buildActivityItem(Icons.assessment, 'Monthly report generated', 'Yesterday', AppColors.warning),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityItem(IconData icon, String title, String time, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
                Text(time, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
