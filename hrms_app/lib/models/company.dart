class CompanyModel {
  final String id;
  final String name;
  final String? code;
  final String? address;
  final String? phone;
  final String? email;
  final String? website;
  final String? logo;
  final int? employeeCount;
  final String? industry;

  CompanyModel({
    required this.id,
    required this.name,
    this.code,
    this.address,
    this.phone,
    this.email,
    this.website,
    this.logo,
    this.employeeCount,
    this.industry,
  });

  factory CompanyModel.fromJson(Map<String, dynamic> json) {
    return CompanyModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      code: json['code'],
      address: json['address'],
      phone: json['phone'],
      email: json['email'],
      website: json['website'],
      logo: json['logo'],
      employeeCount: json['employeeCount'],
      industry: json['industry'],
    );
  }
}
