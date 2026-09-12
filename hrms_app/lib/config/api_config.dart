class ApiConfig {
  static const String baseUrl = 'https://nexus-hrms-mu.vercel.app';
  static const String apiPrefix = '/api';
  static const Duration timeout = Duration(seconds: 30);
  static const String tenantSlug = '3boxes-hrms-demo';

  // Demo credentials
  static const String demoEmail = 'admin@3boxes.com';
  static const String demoPassword = 'MarqAI@2026';

  // Current active tenant slug (can be changed at runtime)
  static String _activeTenantSlug = tenantSlug;
  static String get activeTenantSlug => _activeTenantSlug;
  static void setActiveTenantSlug(String slug) => _activeTenantSlug = slug;

  static String get apiUrl => '$baseUrl$apiPrefix';

  // Auth
  static String get login => '$apiUrl/auth/login';
  static String get me => '$apiUrl/auth/me';

  // Employees
  static String get employees => '$apiUrl/employees';
  static String employeeDetail(String id) => '$apiUrl/employees/$id';

  // Dashboard
  static String get dashboard => '$apiUrl/dashboard';

  // Leaves
  static String get leaves => '$apiUrl/leaves';
  static String leaveDetail(String id) => '$apiUrl/leaves/$id';

  // Attendance
  static String get attendance => '$apiUrl/attendance';

  // Companies
  static String get companies => '$apiUrl/companies';

  // Reports
  static String get reportsExport => '$apiUrl/reports/export';

  // Tenant Config
  static String get tenantConfiguration => '$apiUrl/tenant-configuration';

  // Tenant Info (public endpoint)
  static String tenantInfo(String slug) => '$apiUrl/public/tenant-info?slug=$slug';

  // Notifications
  static String get notifications => '$apiUrl/notifications';

  // RBAC
  static String get rbacModules => '$apiUrl/rbac/modules';

  // Check if current login is demo
  static bool get isDemoTenant => _activeTenantSlug == tenantSlug;
}
