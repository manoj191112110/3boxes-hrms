import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'config/colors.dart';
import 'config/constants.dart';
import 'providers/auth_provider.dart';
import 'providers/employee_provider.dart';
import 'providers/leave_provider.dart';
import 'providers/attendance_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/splash/splash_screen.dart';
import 'screens/login/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/employees/employee_list_screen.dart';
import 'screens/leaves/leave_list_screen.dart';
import 'screens/leaves/leave_request_screen.dart';
import 'screens/attendance/attendance_screen.dart';
import 'screens/reports/reports_screen.dart';
import 'screens/notifications/notifications_screen.dart';

class HrmsApp extends StatelessWidget {
  const HrmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => EmployeeProvider()),
        ChangeNotifierProvider(create: (_) => LeaveProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: MaterialApp(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        initialRoute: '/',
        routes: {
          '/': (_) => const SplashScreen(),
          '/login': (_) => const LoginScreen(),
          '/dashboard': (_) => const DashboardScreen(),
          '/employees': (_) => const EmployeeListScreen(),
          '/leaves': (_) => const LeaveListScreen(),
          '/leave-request': (_) => const LeaveRequestScreen(),
          '/attendance': (_) => const AttendanceScreen(),
          '/reports': (_) => const ReportsScreen(),
          '/notifications': (_) => const NotificationsScreen(),
        },
      ),
    );
  }
}
