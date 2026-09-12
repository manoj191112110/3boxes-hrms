import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/colors.dart';
import '../../config/constants.dart';
import '../../services/tenant_logo_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  // Logo state
  TenantLogoInfo? _logoInfo;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );
    _controller.forward();
    _loadTenantLogo();
  }

  Future<void> _loadTenantLogo() async {
    final info = await TenantLogoService.getCurrentLogo();
    if (mounted) {
      setState(() => _logoInfo = info);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Build the logo widget.
  Widget _buildLogo() {
    const logoSize = 100.0;
    final info = _logoInfo;

    if (info != null) {
      if (info.isAsset) {
        return Image.asset(
          info.logoPath,
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _buildFallbackIcon(),
        );
      } else {
        return CachedNetworkImage(
          imageUrl: info.logoPath,
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
          placeholder: (_, __) => _buildFallbackIcon(),
          errorWidget: (_, __, ___) => Image.asset(
            TenantLogoService.companyDefaultLogo,
            width: logoSize,
            height: logoSize,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _buildFallbackIcon(),
          ),
        );
      }
    }

    // Default: 3Boxes logo
    return Image.asset(
      TenantLogoService.threeBoxesLogo,
      width: logoSize,
      height: logoSize,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => _buildFallbackIcon(),
    );
  }

  Widget _buildFallbackIcon() {
    return const Icon(Icons.business_center, color: Colors.white, size: 64);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: _buildLogo(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _logoInfo?.tenantName ?? AppConstants.appName,
                    style: const TextStyle(
                      color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(AppConstants.companyTagline, style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8), fontSize: 16, fontWeight: FontWeight.w400,
                  )),
                  const SizedBox(height: 48),
                  SizedBox(
                    width: 40, height: 40,
                    child: CircularProgressIndicator(
                      strokeWidth: 3, color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
