import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import '../widgets/logo.dart';
import 'webview_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _serverController = TextEditingController();
  bool _isLoading = false;
  bool _showServerConfig = false;

  final List<Map<String, String>> _demoAccounts = [
    {'role': 'Super Admin', 'email': 'admin@3boxeshrms.com', 'password': 'admin123', 'color': '#F59E0B'},
    {'role': 'HR Admin', 'email': 'hr@3boxeshrms.com', 'password': 'hr123', 'color': '#3B82F6'},
    {'role': 'Manager', 'email': 'manager@3boxeshrms.com', 'password': 'manager123', 'color': '#8B5CF6'},
    {'role': 'Employee', 'email': 'employee@3boxeshrms.com', 'password': 'employee123', 'color': '#10B981'},
    {'role': 'Recruiter', 'email': 'recruiter@3boxeshrms.com', 'password': 'recruiter123', 'color': '#EC4899'},
    {'role': 'Candidate', 'email': 'candidate@3boxeshrms.com', 'password': 'candidate123', 'color': '#06B6D4'},
  ];

  @override
  void initState() {
    super.initState();
    _loadServerUrl();
  }

  Future<void> _loadServerUrl() async {
    final url = await AuthService.getServerUrl();
    _serverController.text = url;
  }

  Future<void> _connect({String? email, String? password}) async {
    setState(() { _isLoading = true; });
    try {
      final serverUrl = _serverController.text.trim().isEmpty
          ? await AuthService.getServerUrl()
          : _serverController.text.trim();
      await AuthService.setServerUrl(serverUrl);
      await AuthService.setToken('mobile-pending');

      String url = '$serverUrl/login?mobile=true';
      if (email != null && password != null) {
        url += '&email=${Uri.encodeComponent(email)}&password=${Uri.encodeComponent(password)}';
      }

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => MainWebViewScreen(initialUrl: url)),
        );
      }
    } catch (e) {
      if (mounted) setState(() { _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: screenHeight * 0.08),
              // Logo
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF8B5CF6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Center(child: ThreeBoxesLogo(size: 44, white: true)),
                ),
              ),
              const SizedBox(height: 16),
              const Center(
                child: Column(
                  children: [
                    Text('3 Boxes HRMS', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: -0.5)),
                    SizedBox(height: 2),
                    Text('People \u00b7 Process \u00b7 Technology', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), letterSpacing: 2, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              SizedBox(height: screenHeight * 0.04),

              // Connect Button
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF8B5CF6)]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(color: const Color(0xFF3B82F6).withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _isLoading ? null : () => _connect(),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: _isLoading
                          ? const Center(child: SpinKitThreeBounce(color: Colors.white, size: 20))
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.login_rounded, color: Colors.white, size: 20),
                                SizedBox(width: 8),
                                Text('Connect & Sign In', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.3)),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Demo Accounts Divider
              Row(
                children: [
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('Demo Accounts', style: TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                  ),
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                ],
              ),
              const SizedBox(height: 12),

              // Demo Accounts Grid
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 3.2,
                ),
                itemCount: _demoAccounts.length,
                itemBuilder: (context, index) {
                  final account = _demoAccounts[index];
                  final color = _parseColor(account['color']!);
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _isLoading ? null : () => _connect(email: account['email'], password: account['password']),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: color.withValues(alpha: 0.15)),
                        ),
                        child: Row(
                          children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(account['role']!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary), overflow: TextOverflow.ellipsis),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),

              // Server Config
              InkWell(
                onTap: () => setState(() => _showServerConfig = !_showServerConfig),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_showServerConfig ? Icons.keyboard_arrow_up : Icons.settings_outlined, size: 16, color: AppTheme.textMuted),
                    const SizedBox(width: 4),
                    Text('Server Configuration', style: TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              if (_showServerConfig) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _serverController,
                  decoration: InputDecoration(
                    labelText: 'Server URL',
                    hintText: 'https://nexus-hrms-mu.vercel.app',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppTheme.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppTheme.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppTheme.primary, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  style: const TextStyle(fontSize: 13),
                  keyboardType: TextInputType.url,
                ),
              ],
              const SizedBox(height: 20),

              // Footer
              Center(
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.verified_user, size: 12, color: AppTheme.success),
                        const SizedBox(width: 4),
                        Text('Enterprise-grade security', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                        const SizedBox(width: 12),
                        Icon(Icons.cloud_outlined, size: 12, color: AppTheme.primary),
                        const SizedBox(width: 4),
                        Text('Auto-updates', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('\u00a9 ${DateTime.now().year} 3 Boxes HRMS', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Color _parseColor(String hex) {
    return Color(int.parse(hex.replaceFirst('#', 'FF'), radix: 16));
  }
}
