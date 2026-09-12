class DashboardStats {
  final int totalEmployees;
  final int presentToday;
  final int onLeave;
  final int openPositions;
  final int pendingApprovals;
  final int newHires;
  final double attendanceRate;
  final List<DepartmentStat>? departmentStats;
  final List<RecentActivity>? recentActivities;

  DashboardStats({
    this.totalEmployees = 0,
    this.presentToday = 0,
    this.onLeave = 0,
    this.openPositions = 0,
    this.pendingApprovals = 0,
    this.newHires = 0,
    this.attendanceRate = 0,
    this.departmentStats,
    this.recentActivities,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalEmployees: json['totalEmployees'] ?? json['employeeCount'] ?? 0,
      presentToday: json['presentToday'] ?? json['presentCount'] ?? 0,
      onLeave: json['onLeave'] ?? json['leaveCount'] ?? 0,
      openPositions: json['openPositions'] ?? 0,
      pendingApprovals: json['pendingApprovals'] ?? 0,
      newHires: json['newHires'] ?? 0,
      attendanceRate: (json['attendanceRate'] ?? 0).toDouble(),
      departmentStats: (json['departmentStats'] as List?)
          ?.map((e) => DepartmentStat.fromJson(e))
          .toList(),
      recentActivities: (json['recentActivities'] as List?)
          ?.map((e) => RecentActivity.fromJson(e))
          .toList(),
    );
  }
}

class DepartmentStat {
  final String name;
  final int count;
  final double percentage;

  DepartmentStat({required this.name, required this.count, this.percentage = 0});

  factory DepartmentStat.fromJson(Map<String, dynamic> json) {
    return DepartmentStat(
      name: json['name'] ?? json['department'] ?? '',
      count: json['count'] ?? json['employeeCount'] ?? 0,
      percentage: (json['percentage'] ?? 0).toDouble(),
    );
  }
}

class RecentActivity {
  final String title;
  final String? description;
  final String? type;
  final DateTime? time;

  RecentActivity({required this.title, this.description, this.type, this.time});

  factory RecentActivity.fromJson(Map<String, dynamic> json) {
    return RecentActivity(
      title: json['title'] ?? '',
      description: json['description'],
      type: json['type'],
      time: json['time'] != null ? DateTime.tryParse(json['time'].toString()) : null,
    );
  }
}
