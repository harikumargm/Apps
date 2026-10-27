import "package:flutter/material.dart";

class SutraColors {
  static const paper = Color(0xFFF3EFE6);
  static const ink = Color(0xFF161513);
  static const muted = Color(0xFF6E685F);
  static const indigo = Color(0xFF1D3557);
  static const madder = Color(0xFF8D3A32);
  static const art = Color(0xFFE6DFD1);
  static const line = Color(0x24161513);
}

ThemeData sutraTheme() {
  final base = ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: SutraColors.paper,
    colorScheme: ColorScheme.fromSeed(seedColor: SutraColors.indigo, surface: SutraColors.paper),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: SutraColors.ink, displayColor: SutraColors.ink),
    appBarTheme: const AppBarTheme(
      backgroundColor: SutraColors.paper,
      foregroundColor: SutraColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
  );
}
