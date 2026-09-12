class LeaveModel {
  final String id;
  final String? employeeId;
  final String? employeeName;
  final String leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final String? reason;
  final double? daysCount;
  final DateTime? createdAt;
  final String? approvedBy;
  final String? contactNumber;

  LeaveModel({
    required this.id,
    this.employeeId,
    this.employeeName,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.reason,
    this.daysCount,
    this.createdAt,
    this.approvedBy,
    this.contactNumber,
  });

  factory LeaveModel.fromJson(Map<String, dynamic> json) {
    return LeaveModel(
      id: json['id'] ?? '',
      employeeId: json['employeeId'],
      employeeName: json['employeeName'] ?? json['employee']?['name'],
      leaveType: json['leaveType'] ?? json['type'] ?? 'Casual Leave',
      startDate: DateTime.tryParse(json['startDate']?.toString() ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? '') ?? DateTime.now(),
      status: json['status'] ?? 'PENDING',
      reason: json['reason'],
      daysCount: (json['daysCount'] ?? json['numberOfDays'])?.toDouble(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      approvedBy: json['approvedBy'] ?? json['approverName'],
      contactNumber: json['contactNumber'],
    );
  }

  Map<String, dynamic> toJson() => {
        'leaveType': leaveType,
        'startDate': startDate.toIso8601String().split('T')[0],
        'endDate': endDate.toIso8601String().split('T')[0],
        'reason': reason,
        'contactNumber': contactNumber,
        if (daysCount != null) 'numberOfDays': daysCount,
      };

  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isApproved => status.toUpperCase() == 'APPROVED';
  bool get isRejected => status.toUpperCase() == 'REJECTED';

  String get durationText {
    if (daysCount != null && daysCount! > 0) return '${daysCount!.toInt()} day${daysCount! > 1 ? 's' : ''}';
    final diff = endDate.difference(startDate).inDays + 1;
    return '$diff day${diff > 1 ? 's' : ''}';
  }
}
