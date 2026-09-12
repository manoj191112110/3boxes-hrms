import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/api_config.dart';
import '../../config/colors.dart';
import '../../config/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/tenant_logo_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantSlugController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _showTenantField = false;
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  // Logo state
  TenantLogoInfo? _currentLogoInfo;
  bool _isFetchingLogo = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _fadeIn = Tween<double>(begin: 0.0, end: 1.0).animate(_animController);
    _animController.forward();
    _loadSavedCredentials();
  }

  Future<void> _loadSavedCredentials() async {
    // Load cached tenant logo info
    final cached = await TenantLogoService.getCachedLogoInfo();
    if (cached != null && mounted) {
      setState(() => _currentLogoInfo = cached);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _tenantSlugController.dispose();
    super.dispose();
  }

  /// Fill in demo credentials and switch to 3Boxes logo.
  void _fillDemoCredentials() {
    _emailController.text = ApiConfig.demoEmail;
    _passwordController.text = ApiConfig.demoPassword;
    _tenantSlugController.clear();
    setState(() {
      _showTenantField = false;
      _currentLogoInfo = TenantLogoInfo(
        slug: ApiConfig.tenantSlug,
        tenantName: '3Boxes HRMS Demo',
        logoPath: TenantLogoService.threeBoxesLogo,
        isAsset: true,
      );
    });
  }

  /// Fetch tenant logo when a slug is entered.
  Future<void> _fetchTenantLogo(String slug) async {
    if (slug.trim().isEmpty) {
      // Revert to 3Boxes logo
      setState(() {
        _currentLogoInfo = TenantLogoInfo(
          slug: ApiConfig.tenantSlug,
          tenantName: '3Boxes HRMS',
          logoPath: TenantLogoService.threeBoxesLogo,
          isAsset: true,
        );
      });
      return;
    }

    setState(() => _isFetchingLogo = true);
    try {
      final info = await TenantLogoService.fetchTenantLogo(slug.trim());
      if (mounted) {
        setState(() => _currentLogoInfo = info);
      }
    } finally {
      if (mounted) setState(() => _isFetchingLogo = false);
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    // Determine tenant slug
    final slug = _tenantSlugController.text.trim().isEmpty
        ? ApiConfig.tenantSlug
        : _tenantSlugController.text.trim();

    // Fetch/update tenant logo before login
    await TenantLogoService.fetchTenantLogo(slug);

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.login(_emailController.text.trim(), _passwordController.text);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error ?? 'Login failed'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  /// Build the logo widget based on current context.
  Widget _buildLogo() {
    final info = _currentLogoInfo;
    const logoSize = 80.0;

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
    return const Icon(Icons.business_center, color: Colors.white, size: 48);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: FadeTransition(
                opacity: _fadeIn,
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    // Logo
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: _isFetchingLogo
                          ? const SizedBox(
                              width: 80,
                              height: 80,
                              child: Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                            )
                          : _buildLogo(),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _currentLogoInfo?.tenantName ?? AppConstants.appName,
                      style: const TextStyle(
                        color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),
                    Text(AppConstants.companyTagline, style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8), fontSize: 14,
                    )),
                    const SizedBox(height: 48),
                    // Login Form Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 20, offset: const Offset(0, 10)),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Welcome Back', style: TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textPrimary,
                            )),
                            const SizedBox(height: 4),
                            const Text('Sign in to continue', style: TextStyle(
                              fontSize: 14, color: AppColors.textSecondary,
                            )),
                            const SizedBox(height: 24),
                            // Tenant slug field (collapsible)
                            Row(
                              children: [
                                Text('Tenant', style: TextStyle(
                                  fontSize: 13, color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                )),
                                const Spacer(),
                                TextButton.icon(
                                  onPressed: () => setState(() => _showTenantField = !_showTenantField),
                                  icon: Icon(
                                    _showTenantField ? Icons.expand_less : Icons.expand_more,
                                    size: 18,
                                    color: AppColors.primary,
                                  ),
                                  label: Text(
                                    _showTenantField ? 'Hide' : 'Change tenant',
                                    style: const TextStyle(fontSize: 12, color: AppColors.primary),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                ),
                              ],
                            ),
                            if (_showTenantField) ...[
                              const SizedBox(height: 8),
                              CustomTextField(
                                label: 'Tenant Slug',
                                hint: 'e.g. 3boxes-technologies',
                                controller: _tenantSlugController,
                                prefixIcon: Icons.domain,
                                keyboardType: TextInputType.text,
                                onChanged: (value) {
                                  // Debounce would be ideal, but for simplicity
                                  // we fetch on change
                                  _fetchTenantLogo(value);
                                },
                              ),
                              const SizedBox(height: 16),
                            ],
                            // Email
                            CustomTextField(
                              label: 'Email',
                              hint: 'Enter your email',
                              controller: _emailController,
                              prefixIcon: Icons.email_outlined,
                              keyboardType: TextInputType.emailAddress,
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Email is required';
                                if (!v.contains('@')) return 'Enter a valid email';
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            // Password
                            CustomTextField(
                              label: 'Password',
                              hint: 'Enter your password',
                              controller: _passwordController,
                              prefixIcon: Icons.lock_outline,
                              obscureText: _obscurePassword,
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Password is required';
                                if (v.length < 6) return 'Password must be at least 6 characters';
                                return null;
                              },
                              suffixIcon: IconButton(
                                icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: AppColors.textTertiary),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            const SizedBox(height: 12),
                            // Remember me & Forgot
                            Row(
                              children: [
                                SizedBox(
                                  height: 24, width: 24,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (v) => setState(() => _rememberMe = v ?? false),
                                    activeColor: AppColors.primary,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text('Remember me', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                                const Spacer(),
                                TextButton(
                                  onPressed: () {},
                                  child: const Text('Forgot Password?', style: TextStyle(fontSize: 13, color: AppColors.primary)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            // Login Button
                            CustomButton(
                              text: 'Sign In',
                              isLoading: authProvider.isLoading,
                              onPressed: _handleLogin,
                              icon: Icons.login,
                            ),
                            const SizedBox(height: 16),
                            // Demo Login Quick-Fill Button
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: _fillDemoCredentials,
                                icon: const Icon(Icons.play_arrow_rounded, size: 20),
                                label: const Text('Demo Login'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.primary,
                                  side: const BorderSide(color: AppColors.primary, width: 1.5),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Demo credentials hint
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Column(
                        children: [
                          Text('Demo Credentials', style: TextStyle(
                            color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600,
                          )),
                          SizedBox(height: 4),
                          Text('admin@3boxes.com / MarqAI@2026', style: TextStyle(
                            color: Colors.white70, fontSize: 11,
                          )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text('v${AppConstants.appVersion}', style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5), fontSize: 12,
                    )),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
