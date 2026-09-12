class TenantConfigModel {
  final String id;
  final String? tenantId;
  final String? companyName;
  final String? companyLogo;
  final String? primaryColor;
  final String? secondaryColor;
  final String? currency;
  final String? dateFormat;
  final String? timeZone;
  final String? locale;
  final bool? leaveApprovalRequired;
  final bool? attendanceAutoCheckout;
  final int? defaultLeaveQuota;
  final int? probationPeriodDays;
  final Map<String, dynamic>? extra;

  TenantConfigModel({
    required this.id,
    this.tenantId,
    this.companyName,
    this.companyLogo,
    this.primaryColor,
    this.secondaryColor,
    this.currency,
    this.dateFormat,
    this.timeZone,
    this.locale,
    this.leaveApprovalRequired,
    this.attendanceAutoCheckout,
    this.defaultLeaveQuota,
    this.probationPeriodDays,
    this.extra,
  });

  factory TenantConfigModel.fromJson(Map<String, dynamic> json) {
    return TenantConfigModel(
      id: json['id'] ?? '',
      tenantId: json['tenantId'],
      companyName: json['companyName'] ?? json['company']?['name'],
      companyLogo: json['companyLogo'] ?? json['logo'],
      primaryColor: json['primaryColor'],
      secondaryColor: json['secondaryColor'],
      currency: json['currency'] ?? 'INR',
      dateFormat: json['dateFormat'] ?? 'DD/MM/YYYY',
      timeZone: json['timeZone'] ?? 'Asia/Kolkata',
      locale: json['locale'] ?? 'en',
      leaveApprovalRequired: json['leaveApprovalRequired'] ?? true,
      attendanceAutoCheckout: json['attendanceAutoCheckout'] ?? false,
      defaultLeaveQuota: json['defaultLeaveQuota'] ?? 20,
      probationPeriodDays: json['probationPeriodDays'] ?? 90,
      extra: json,
    );
  }
}
