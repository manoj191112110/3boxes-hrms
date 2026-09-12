import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/colors.dart';
import '../../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 60, 20, 32),
              decoration: const BoxDecoration(gradient: AppColors.headerGradient),
              child: Column(
                children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Center(
                      child: Text(user?.initials ?? '?', style: const TextStyle(
                        color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700,
                      )),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(user?.displayName ?? 'User', style: const TextStyle(
                    color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700,
                  )),
                  if (user?.email != null)
                    Text(user!.email!, style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8), fontSize: 14,
                    )),
                  if (user?.role != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(user!.role!, style: const TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ],
                ],
              ),
            ),
            // Menu items
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _menuSection('Account', [
                    _menuItem(Icons.person, 'Personal Information', () {}),
                    _menuItem(Icons.work, 'Employment Details', () {}),
                    _menuItem(Icons.lock, 'Change Password', () {}),
                  ]),
                  const SizedBox(height: 16),
                  _menuSection('Preferences', [
                    _menuItem(Icons.notifications, 'Notification Settings', () {}),
                    _menuItem(Icons.language, 'Language & Region', () {}),
                    _menuItem(Icons.dark_mode, 'Appearance', () {}),
                  ]),
                  const SizedBox(height: 16),
                  _menuSection('Support', [
                    _menuItem(Icons.help, 'Help & FAQ', () {}),
                    _menuItem(Icons.info, 'About App', () {}),
                  ]),
                  const SizedBox(height: 24),
                  // Logout
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await context.read<AuthProvider>().logout();
                        if (context.mounted) Navigator.pushReplacementNamed(context, '/login');
                      },
                      icon: const Icon(Icons.logout),
                      label: const Text('Logout'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuSection(String title, List<Widget> items) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            ...items,
          ],
        ),
      ),
    );
  }

  Widget _menuItem(IconData icon, String title, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.textSecondary),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary))),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}
