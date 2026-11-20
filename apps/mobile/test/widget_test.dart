import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:scv/ui/core/garment_painter.dart";
import "package:scv/ui/core/theme.dart";

void main() {
  testWidgets("garment canvas paints a framed cloth", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CustomPaint(
            painter: GarmentPainter(color: ScvColors.indigo, weave: "twill"),
            child: const SizedBox(width: 120, height: 160),
          ),
        ),
      ),
    );
    expect(find.byType(CustomPaint), findsWidgets);
  });
}
