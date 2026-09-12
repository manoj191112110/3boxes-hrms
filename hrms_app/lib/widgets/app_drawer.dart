import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/colors.dart';
import '../config/constants.dart';
import '../providers/auth_provider.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../services/tenant_logo_service.dart';

class AppDrawer extends StatelessWidget {
  final int currentIndex;

  const AppDrawer({super.key, this.currentIndex = 0});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return Drawer(
      child: Container(
        color: AppColors.surface,
        child: Column(
          children: [
            Container(
              decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 16,
                left: 16, right: 16, bottom: 24,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      // Tenant logo
                      FutureBuilder<TenantLogoInfo>(
                        future: TenantLogoService.getCurrentLogo(),
                        builder: (context, snapshot) {
                          final info = snapshot.data;
                          if (info != null) {
                            if (info.isAsset) {
                              return Container(
                                width: 56, height: 56,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withValues(alpha: 0.2),
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: ClipOval(
                                  child: Padding(
                                    padding: const EdgeInsets.all(4),
                                    child: Image.asset(
                                      info.logoPath,
                                      fit: BoxFit.contain,
                                      errorBuilder: (_, __, ___) => _buildUserInitials(user),
                                    ),
                                  ),
                                ),
                              );
                            } else {
                              return Container(
                                width: 56, height: 56,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withValues(alpha: 0.2),
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: ClipOval(
                                  child: Padding(
                                    padding: const EdgeInsets.all(4),
                                    child: CachedNetworkImage(
                                      imageUrl: info.logoPath,
                                      fit: BoxFit.contain,
                                      placeholder: (_, __) => _buildUserInitials(user),
                                      errorWidget: (_, __, ___) => _buildUserInitials(user),
                                    ),
                                  ),
                                ),
                              );
                            }
                          }
                          return Container(
                            width: 56, height: 56,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.2),
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: _buildUserInitials(user),
                          );
                        },
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user?.displayName ?? 'User', style: const TextStyle(
                              color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600,
                            ), maxLines: 1, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            Text(user?.email ?? '', style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8), fontSize: 12,
                            ), maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  _buildDrawerItem(context: context, icon: Icons.dashboard_outlined, title: 'Dashboard', isSelected: currentIndex == 0, onTap: () { Navigator.pop(context); if (currentIndex != 0) Navigator.pushReplacementNamed(context, '/dashboard'); }),
                  _buildDrawerItem(context: context, icon: Icons.people_outlined, title: 'Employees', isSelected: currentIndex == 1, onTap: () { Navigator.pop(context); if (currentIndex != 1) Navigator.pushReplacementNamed(context, '/employees'); }),
                  _buildDrawerItem(context: context, icon: Icons.event_note_outlined, title: 'Leaves', isSelected: currentIndex == 2, onTap: () { Navigator.pop(context); }),
                  _buildDrawerItem(context: context, icon: Icons.access_time_outlined, title: 'Attendance', isSelected: currentIndex == 3, onTap: () { Navigator.pop(context); Navigator.pushReplacementNamed(context, '/attendance'); }),
                  _buildDrawerItem(context: context, icon: Icons.assessment_outlined, title: 'Reports', isSelected: currentIndex == 4, onTap: () { Navigator.pop(context); Navigator.pushReplacementNamed(context, '/reports'); }),
                  const Divider(indent: 16, endIndent: 16, height: 24),
                  _buildDrawerItem(context: context, icon: Icons.notifications_outlined, title: 'Notifications', isSelected: false, onTap: () { Navigator.pop(context); Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())); }),
                  _buildDrawerItem(context: context, icon: Icons.person_outlined, title: 'Profile', isSelected: false, onTap: () { Navigator.pop(context); Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen())); }),
                  _buildDrawerItem(context: context, icon: Icons.settings_outlined, title: 'Settings', isSelected: false, onTap: () { Navigator.pop(context); Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())); }),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: _buildDrawerItem(
                context: context, icon: Icons.logout, title: 'Logout', isSelected: false, color: AppColors.error,
                onTap: () async {
                  Navigator.pop(context);
                  await authProvider.logout();
                  if (context.mounted) Navigator.pushReplacementNamed(context, '/login');
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text('${AppConstants.appName} v${AppConstants.appVersion}', style: const TextStyle(color: AppColors.textTertiary, fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUserInitials(user) {
    return Center(
      child: Text(user?.initials ?? 'U', style: const TextStyle(
        color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold,
      )),
    );
  }

  Widget _buildDrawerItem({required BuildContext context, required IconData icon, required String title, required bool isSelected, required VoidCallback onTap, Color? color}) {
    final itemColor = color ?? (isSelected ? AppColors.primary : AppColors.textSecondary);
    return ListTile(
      leading: Icon(icon, color: itemColor, size: 22),
      title: Text(title, style: TextStyle(color: itemColor, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal, fontSize: 14)),
      selected: isSelected,
      selectedTileColor: AppColors.primary.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      dense: true,
      onTap: onTap,
    );
  }
}
