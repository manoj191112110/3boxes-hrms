class AppConstants {
  static const String appName = '3Boxes HRMS';
  static const String appVersion = '1.0.0';
  static const String companyName = '3Boxes Technologies';
  static const String companyTagline = 'Smart HR Management';

  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'user_data';
  static const String rememberMeKey = 'remember_me';
  static const String themeKey = 'theme_mode';

  // Pagination
  static const int defaultPageSize = 20;

  // Date formats
  static const String dateFormat = 'dd MMM yyyy';
  static const String timeFormat = 'hh:mm a';
  static const String dateTimeFormat = 'dd MMM yyyy, hh:mm a';
  static const String apiDateFormat = 'yyyy-MM-dd';

  // Leave statuses
  static const String leavePending = 'PENDING';
  static const String leaveApproved = 'APPROVED';
  static const String leaveRejected = 'REJECTED';
  static const String leaveCancelled = 'CANCELLED';

  // Employee statuses
  static const String employeeActive = 'ACTIVE';
  static const String employeeInactive = 'INACTIVE';
  static const String employeeOnProbation = 'ON_PROBATION';
  static const String employeeResigned = 'RESIGNED';

  // Attendance statuses
  static const String attendancePresent = 'PRESENT';
  static const String attendanceAbsent = 'ABSENT';
  static const String attendanceHalfDay = 'HALF_DAY';
  static const String attendanceOnLeave = 'ON_LEAVE';
  static const String attendanceWfh = 'WORK_FROM_HOME';
}
