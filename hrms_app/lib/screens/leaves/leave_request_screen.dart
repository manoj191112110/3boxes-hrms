import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../config/colors.dart';
import '../../config/constants.dart';
import '../../providers/leave_provider.dart';
import '../../widgets/custom_button.dart';

class LeaveRequestScreen extends StatefulWidget {
  const LeaveRequestScreen({super.key});

  @override
  State<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

class _LeaveRequestScreenState extends State<LeaveRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  final _contactController = TextEditingController();
  String _leaveType = 'Casual Leave';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final List<String> _leaveTypes = [
    'Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave',
    'Paternity Leave', 'Comp Off', 'Loss of Pay', 'Half Day Leave',
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    _contactController.dispose();
    super.dispose();
  }

  int get _daysCount => _endDate.difference(_startDate).inDays + 1;

  Future<void> _selectDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: isStart ? DateTime.now() : _startDate,
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: Theme.of(ctx).colorScheme.copyWith(primary: AppColors.primary)),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(_startDate)) _endDate = _startDate;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final success = await context.read<LeaveProvider>().createLeave({
      'leaveType': _leaveType,
      'startDate': DateFormat('yyyy-MM-dd').format(_startDate),
      'endDate': DateFormat('yyyy-MM-dd').format(_endDate),
      'reason': _reasonController.text.trim(),
      'contactNumber': _contactController.text.trim(),
      'numberOfDays': _daysCount,
    });
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Leave request submitted successfully'), backgroundColor: AppColors.success),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<LeaveProvider>().error ?? 'Failed'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeaveProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Apply Leave')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Leave Type
              const Text('Leave Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _leaveType,
                    isExpanded: true,
                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.textTertiary),
                    items: _leaveTypes.map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 14)))).toList(),
                    onChanged: (v) => setState(() => _leaveType = v!),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Date Range
              Row(
                children: [
                  Expanded(child: _buildDatePicker('From', _startDate, true)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildDatePicker('To', _endDate, false)),
                ],
              ),
              const SizedBox(height: 12),
              // Days count
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.calendar_today, color: AppColors.primary, size: 18),
                    const SizedBox(width: 8),
                    Text('$_daysCount Day${_daysCount > 1 ? 's' : ''}', style: const TextStyle(
                      color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w600,
                    )),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              // Reason
              const Text('Reason', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _reasonController,
                maxLines: 4,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Please provide a reason' : null,
                decoration: InputDecoration(
                  hintText: 'Enter reason for leave',
                  filled: true, fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              // Contact Number
              const Text('Contact During Leave', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _contactController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  hintText: 'Enter contact number',
                  prefixIcon: const Icon(Icons.phone, color: AppColors.textTertiary, size: 20),
                  filled: true, fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 32),
              // Submit
              CustomButton(
                text: 'Submit Leave Request',
                isLoading: provider.isSubmitting,
                onPressed: _submit,
                icon: Icons.send,
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDatePicker(String label, DateTime date, bool isStart) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () => _selectDate(isStart),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today, color: AppColors.primary, size: 20),
                const SizedBox(width: 8),
                Text(DateFormat('dd MMM yyyy').format(date), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
