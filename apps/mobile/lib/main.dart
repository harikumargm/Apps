import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "di.dart";
import "ui/core/theme.dart";
import "ui/features/shop/views/shop_views.dart";

void main() {
  setupDependencies();
  runApp(const ProviderScope(child: SutraApp()));
}

class SutraApp extends StatelessWidget {
  const SutraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Sutra",
      theme: sutraTheme(),
      home: const StudioShell(),
    );
  }
}

class StudioShell extends StatefulWidget {
  const StudioShell({super.key});

  @override
  State<StudioShell> createState() => _StudioShellState();
}

class _StudioShellState extends State<StudioShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    const pages = [HomeView(), CatalogView(), BagView(), AccountView()];
    return Scaffold(
      appBar: AppBar(title: const Text("Sutra")),
      body: pages[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        backgroundColor: SutraColors.paper,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: "Home"),
          NavigationDestination(icon: Icon(Icons.checkroom_outlined), label: "Shop"),
          NavigationDestination(icon: Icon(Icons.shopping_bag_outlined), label: "Bag"),
          NavigationDestination(icon: Icon(Icons.person_outline), label: "Account"),
        ],
      ),
    );
  }
}
