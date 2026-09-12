import 'package:flutter/material.dart';
import '../config/colors.dart';

class LoadingWidget extends StatelessWidget {
  final int itemCount;
  final bool isCard;

  const LoadingWidget({super.key, this.itemCount = 5, this.isCard = true});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      itemBuilder: (context, index) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.divider,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(
              color: AppColors.border, borderRadius: BorderRadius.circular(14),
            )),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 150, height: 14, decoration: BoxDecoration(
                    color: AppColors.border, borderRadius: BorderRadius.circular(4),
                  )),
                  const SizedBox(height: 8),
                  Container(width: 100, height: 12, decoration: BoxDecoration(
                    color: AppColors.border, borderRadius: BorderRadius.circular(4),
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
