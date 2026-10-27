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

class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image(image: AssetImage("assets/brand/vastram-mark.jpg"), width: 36, height: 36),
        SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("VASTRAM", style: TextStyle(fontSize: 15, letterSpacing: 2, fontWeight: FontWeight.w600, color: Color(0xFF8A6A2A))),
            Text("premium quality clothing", style: TextStyle(fontSize: 10, color: SutraColors.muted)),
          ],
        ),
      ],
    );
  }
}
