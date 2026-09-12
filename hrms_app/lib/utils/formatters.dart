import 'package:intl/intl.dart';

class Formatters {
  static String currency(double amount, {String symbol = '₹'}) {
    return '$symbol${NumberFormat.decimalPattern('en_IN').format(amount)}';
  }

  static String percentage(double value) {
    return '${value.toStringAsFixed(1)}%';
  }

  static String compactNumber(int number) {
    if (number >= 1000000) return '${(number / 1000000).toStringAsFixed(1)}M';
    if (number >= 1000) return '${(number / 1000).toStringAsFixed(1)}K';
    return number.toString();
  }

  static String phone(String phone) {
    if (phone.length == 10) return '${phone.substring(0, 5)} ${phone.substring(5)}';
    return phone;
  }
}
