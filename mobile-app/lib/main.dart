import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';
import 'widgets/logo.dart';
import 'screens/login_screen.dart';
import 'screens/webview_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ThreeBoxesHRMSApp());
}

class ThreeBoxesHRMSApp extends StatelessWidget {
  const ThreeBoxesHRMSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '3 Boxes HRMS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    await Future.delayed(const Duration(seconds: 2));
    final isLoggedIn = await AuthService.isLoggedIn();
    final serverUrl = await AuthService.getServerUrl();

    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => isLoggedIn
            ? MainWebViewScreen(initialUrl: serverUrl)
            : const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Center(child: ThreeBoxesLogo(size: 56, white: true)),
              ),
              const SizedBox(height: 24),
              const Text('3 Boxes HRMS', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: -0.5)),
              const SizedBox(height: 4),
              Text('People \u00b7 Process \u00b7 Technology', style: TextStyle(fontSize: 12, color: AppTheme.textMuted, letterSpacing: 2.5, fontWeight: FontWeight.w500)),
              const SizedBox(height: 40),
              SpinKitThreeBounce(color: AppTheme.primary, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
