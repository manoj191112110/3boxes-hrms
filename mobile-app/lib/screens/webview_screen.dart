import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';

class MainWebViewScreen extends StatefulWidget {
  final String initialUrl;

  const MainWebViewScreen({super.key, required this.initialUrl});

  @override
  State<MainWebViewScreen> createState() => _MainWebViewScreenState();
}

class _MainWebViewScreenState extends State<MainWebViewScreen> {
  late WebViewController _controller;
  bool _isLoading = true;
  bool _canGoBack = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _isLoading = true),
          onPageFinished: (_) async {
            setState(() => _isLoading = false);
            _canGoBack = await _controller.canGoBack();
            // Inject stored token
            final token = await AuthService.getToken();
            if (token != null && token != 'mobile-pending') {
              await _controller.runJavaScript(
                "if(typeof localStorage !== 'undefined') { localStorage.setItem('tb_token', '$token'); }",
              );
            }
          },
          onNavigationRequest: (request) => NavigationDecision.navigate,
        ),
      )
      ..loadRequest(Uri.parse(widget.initialUrl));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop && _canGoBack) {
          await _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.background,
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_isLoading)
                Container(
                  color: Colors.white,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 32,
                          height: 32,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text('Loading...', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        floatingActionButton: _canGoBack
            ? FloatingActionButton.small(
                onPressed: () => _controller.goBack(),
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                elevation: 4,
                child: const Icon(Icons.arrow_back, size: 18),
              )
            : null,
      ),
    );
  }
}
