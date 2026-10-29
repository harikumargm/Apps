import "dart:ui" as ui;

import "package:flutter/material.dart";

import "theme.dart";

class GarmentPainter extends CustomPainter {
  GarmentPainter({required this.color, required this.weave, this.phase = 0});

  final Color color;
  final String weave;
  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = SutraColors.art);
    final path = Path()
      ..moveTo(size.width * 0.38, size.height * 0.16)
      ..quadraticBezierTo(size.width * 0.5, size.height * 0.24, size.width * 0.62, size.height * 0.16)
      ..lineTo(size.width * 0.78, size.height * 0.28)
      ..lineTo(size.width * 0.7, size.height * 0.36)
      ..lineTo(size.width * 0.66, size.height * 0.72)
      ..quadraticBezierTo(size.width * 0.5, size.height * 0.8, size.width * 0.34, size.height * 0.72)
      ..lineTo(size.width * 0.3, size.height * 0.36)
      ..lineTo(size.width * 0.22, size.height * 0.28)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    final thread = Paint()
      ..color = SutraColors.ink.withValues(alpha: 0.18)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    if (weave == "twill") {
      for (var i = -size.height; i < size.width + size.height; i += 8) {
        canvas.drawLine(Offset(i + phase, 0), Offset(i + size.height * 0.4 + phase, size.height), thread);
      }
    } else {
      for (var y = 0.0; y < size.height; y += 7) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), thread);
      }
      for (var x = 0.0; x < size.width; x += 7) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), thread);
      }
    }
  }

  @override
  bool shouldRepaint(covariant GarmentPainter oldDelegate) => oldDelegate.color != color || oldDelegate.phase != phase || oldDelegate.weave != weave;
}

class WeaveField extends StatefulWidget {
  const WeaveField({super.key, required this.child});

  final Widget child;

  @override
  State<WeaveField> createState() => _WeaveFieldState();
}

class _WeaveFieldState extends State<WeaveField> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  ui.FragmentProgram? _program;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 8))..repeat();
    ui.FragmentProgram.fromAsset("shaders/weave.frag").then((program) {
      if (mounted) setState(() => _program = program);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          painter: _WeavePainter(program: _program, time: _controller.value * 8),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _WeavePainter extends CustomPainter {
  _WeavePainter({required this.program, required this.time});

  final ui.FragmentProgram? program;
  final double time;

  @override
  void paint(Canvas canvas, Size size) {
    final shaderProgram = program;
    if (shaderProgram == null) {
      GarmentPainter(color: SutraColors.art, weave: "plain", phase: time).paint(canvas, size);
      return;
    }
    final shader = shaderProgram.fragmentShader();
    shader.setFloat(0, time);
    shader.setFloat(1, size.width);
    shader.setFloat(2, size.height);
    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(covariant _WeavePainter oldDelegate) => oldDelegate.time != time || oldDelegate.program != program;
}
