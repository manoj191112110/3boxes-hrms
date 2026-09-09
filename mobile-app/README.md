# 3 Boxes HRMS - Flutter Mobile App

## Overview
Native mobile app for 3 Boxes HRMS built with Flutter. The app uses WebView to render the web application, ensuring all web changes are automatically reflected in the mobile app without requiring app updates.

## Features
- **Auto-Update**: All web changes are instantly reflected - no app store updates needed
- **Native Splash Screen**: Professional branded splash screen on app launch
- **Mobile-Optimized Login**: Clean native login screen with demo account quick-connect
- **Server Configuration**: Configurable server URL for self-hosted deployments
- **Android & iOS**: Supports both platforms
- **Push Back Navigation**: Android back button navigates within the WebView

## Setup

### Prerequisites
- Flutter SDK 3.44+ (https://flutter.dev/docs/get-started/install)
- Android Studio or Android SDK
- Xcode (for iOS builds, macOS only)

### Install Dependencies
```bash
cd mobile-app
flutter pub get
```

### Build APK (Android)
```bash
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk`

### Build iOS (macOS only)
```bash
flutter build ios --release
```

### Run in Debug Mode
```bash
flutter run
```

## Project Structure
```
lib/
├── main.dart              # App entry point with splash screen
├── screens/
│   ├── login_screen.dart  # Native mobile login screen
│   └── webview_screen.dart # WebView container for web app
├── services/
│   └── auth_service.dart  # Token & server URL management
├── theme/
│   └── app_theme.dart     # App theme configuration
└── widgets/
    └── logo.dart          # 3 Boxes logo widget
```

## Server Configuration
The app connects to `https://nexus-hrms-mu.vercel.app` by default. To change:
1. Open the app
2. Tap "Server Configuration" at the bottom of the login screen
3. Enter your server URL

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@3boxeshrms.com | admin123 |
| HR Admin | hr@3boxeshrms.com | hr123 |
| Manager | manager@3boxeshrms.com | manager123 |
| Employee | employee@3boxeshrms.com | employee123 |
| Recruiter | recruiter@3boxeshrms.com | recruiter123 |
| Candidate | candidate@3boxeshrms.com | candidate123 |
