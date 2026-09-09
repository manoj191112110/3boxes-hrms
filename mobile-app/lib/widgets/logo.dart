import 'package:flutter/material.dart';

class ThreeBoxesLogo extends StatelessWidget {
  final double size;
  final bool white;

  const ThreeBoxesLogo({super.key, this.size = 40, this.white = false});

  @override
  Widget build(BuildContext context) {
    final boxColor1 = white ? Colors.white.withValues(alpha: 0.9) : const Color(0xFF3B82F6);
    final boxColor2 = white ? Colors.white.withValues(alpha: 0.9) : const Color(0xFF10B981);
    final boxColor3 = white ? Colors.white.withValues(alpha: 0.9) : const Color(0xFF8B5CF6);
    final boxSize = size * 0.28;
    final gap = size * 0.06;
    final radius = size * 0.06;

    return SizedBox(
      width: size,
      height: size,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _box(boxColor1, boxSize, radius),
          SizedBox(width: gap),
          _box(boxColor2, boxSize, radius),
          SizedBox(width: gap),
          _box(boxColor3, boxSize, radius),
        ],
      ),
    );
  }

  Widget _box(Color color, double size, double radius) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
