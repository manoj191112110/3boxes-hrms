class EmployeeModel {
  final String id;
  final String firstName;
  final String? lastName;
  final String? email;
  final String? phone;
  final String? avatar;
  final String? designation;
  final String? department;
  final String? branch;
  final String? status;
  final String? gender;
  final DateTime? joinDate;
  final String? employeeCode;
  final String? reportingManager;

  EmployeeModel({
    required this.id,
    required this.firstName,
    this.lastName,
    this.email,
    this.phone,
    this.avatar,
    this.designation,
    this.department,
    this.branch,
    this.status,
    this.gender,
    this.joinDate,
    this.employeeCode,
    this.reportingManager,
  });

  factory EmployeeModel.fromJson(Map<String, dynamic> json) {
    return EmployeeModel(
      id: json['id'] ?? '',
      firstName: json['firstName'] ?? json['name'] ?? '',
      lastName: json['lastName'],
      email: json['email'] ?? json['workEmail'],
      phone: json['phone'] ?? json['mobileNumber'],
      avatar: json['avatar'] ?? json['profileImage'],
      designation: json['designation'] ?? json['designationName'],
      department: json['department'] ?? json['departmentName'],
      branch: json['branch'] ?? json['branchName'],
      status: json['status'] ?? 'ACTIVE',
      gender: json['gender'],
      joinDate: json['joinDate'] != null ? DateTime.tryParse(json['joinDate'].toString()) : null,
      employeeCode: json['employeeCode'] ?? json['code'],
      reportingManager: json['reportingManager'] ?? json['managerName'],
    );
  }

  String get fullName => '$firstName ${lastName ?? ''}'.trim();
  String get initials {
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return firstName.isNotEmpty ? firstName[0].toUpperCase() : '?';
  }

  bool get isActive => status?.toUpperCase() == 'ACTIVE';
  bool get isOnProbation => status?.toUpperCase() == 'ON_PROBATION';
}
