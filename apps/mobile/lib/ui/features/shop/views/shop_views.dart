import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../../data/repositories/shop_repository.dart";
import "../../../../data/services/api_client.dart";
import "../../../../di.dart";
import "../../../../domain/models/product.dart";
import "../../../core/garment_painter.dart";
import "../../../core/theme.dart";
import "../view_models/shop_controller.dart";

String inr(int value) {
  final digits = value.toString();
  final buffer = StringBuffer("₹");
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(",");
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

class HomeView extends ConsumerWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shop = ref.watch(shopControllerProvider);
    final featured = shop.products.take(4).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        const Text("MONSOON 2026", style: TextStyle(letterSpacing: 2, fontSize: 11, color: SutraColors.muted)),
        const SizedBox(height: 8),
        const Text("The cloth,\nafter the loom.", style: TextStyle(fontSize: 42, height: 0.95, fontFamily: "serif")),
        const SizedBox(height: 12),
        const Text("Fabric readings and a trial view, on the pieces you can actually buy."),
        const SizedBox(height: 20),
        SizedBox(
          height: 120,
          child: WeaveField(
            child: const SizedBox.expand(),
          ),
        ),
        const SizedBox(height: 24),
        if (shop.loading) const LinearProgressIndicator(color: SutraColors.indigo),
        if (shop.error.isNotEmpty) Text(shop.error, style: const TextStyle(color: SutraColors.madder)),
        for (final product in featured) ...[
          const SizedBox(height: 16),
          ProductTile(product: product),
        ],
      ],
    );
  }
}

class CatalogView extends ConsumerStatefulWidget {
  const CatalogView({super.key});

  @override
  ConsumerState<CatalogView> createState() => _CatalogViewState();
}

class _CatalogViewState extends ConsumerState<CatalogView> {
  String audience = "";
  String fabric = "";

  @override
  Widget build(BuildContext context) {
    final shop = ref.watch(shopControllerProvider);
    final items = shop.products.where((product) {
      if (audience.isNotEmpty && product.audience != audience) return false;
      if (fabric.isNotEmpty && product.fabric.type != fabric) return false;
      return true;
    }).toList();
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              for (final entry in ["", "men", "women", "kids"])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(entry.isEmpty ? "All" : entry),
                    selected: audience == entry,
                    onSelected: (_) => setState(() => audience = entry),
                  ),
                ),
              for (final entry in ["Cotton", "Silk", "Linen", "Synthetic blend"])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(entry),
                    selected: fabric == entry,
                    onSelected: (selected) => setState(() => fabric = selected ? entry : ""),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: shop.loading
              ? const Center(child: CircularProgressIndicator(color: SutraColors.indigo))
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.62,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: items.length,
                  itemBuilder: (context, index) => ProductTile(product: items[index], compact: true),
                ),
        ),
      ],
    );
  }
}

class ProductTile extends ConsumerWidget {
  const ProductTile({super.key, required this.product, this.compact = false});

  final Product product;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductView(product: product)));
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 4 / 5,
            child: CustomPaint(
              painter: GarmentPainter(color: _parseHex(product.colors.first.hex), weave: product.fabric.weave),
            ),
          ),
          const SizedBox(height: 8),
          Text(product.fabric.type, style: const TextStyle(fontSize: 11, letterSpacing: 1, color: SutraColors.muted)),
          Text(product.name, style: const TextStyle(fontSize: 18)),
          Text(inr(product.price)),
        ],
      ),
    );
  }
}

class ProductView extends ConsumerStatefulWidget {
  const ProductView({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<ProductView> createState() => _ProductViewState();
}

class _ProductViewState extends ConsumerState<ProductView> {
  late String size = widget.product.sizes.first;
  late String color = widget.product.colors.first.name;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final swatch = product.colors.firstWhere((entry) => entry.name == color);
    return Scaffold(
      appBar: AppBar(title: const Text("Sutra")),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          AspectRatio(
            aspectRatio: 4 / 5,
            child: CustomPaint(
              painter: GarmentPainter(color: _parseHex(swatch.hex), weave: product.fabric.weave),
            ),
          ),
          const SizedBox(height: 16),
          Text(product.name, style: const TextStyle(fontSize: 32)),
          Text(inr(product.price)),
          const SizedBox(height: 8),
          Text(product.summary),
          const SizedBox(height: 16),
          const Text("AI VERIFIED FABRIC BREAKDOWN", style: TextStyle(letterSpacing: 1, fontSize: 11)),
          const SizedBox(height: 6),
          Text("${product.fabric.compositionLabel}\n${product.fabric.weave} · ${product.fabric.weight} · stretch ${product.fabric.stretchIndex}"),
          Text(product.fabric.millNote, style: const TextStyle(color: SutraColors.muted)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in product.sizes)
                ChoiceChip(label: Text(entry), selected: size == entry, onSelected: (_) => setState(() => size = entry)),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: SutraColors.ink, foregroundColor: SutraColors.paper, minimumSize: const Size.fromHeight(48)),
            onPressed: () {
              ref.read(bagControllerProvider.notifier).add(CartLine(
                    productId: product.id,
                    slug: product.slug,
                    name: product.name,
                    size: size,
                    color: color,
                    hex: swatch.hex,
                    silhouette: product.silhouette,
                    qty: 1,
                    unitPrice: product.price,
                  ));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Added to your bag")));
            },
            child: const Text("Add to bag"),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TrialView(product: product))),
            child: const Text("Try it on me"),
          ),
        ],
      ),
    );
  }
}

class BagView extends ConsumerWidget {
  const BagView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lines = ref.watch(bagControllerProvider);
    final total = lines.fold<int>(0, (sum, line) => sum + line.lineTotal);
    if (lines.isEmpty) {
      return const Center(child: Text("Your bag is empty."));
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        for (final line in lines)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(line.name),
            subtitle: Text("${line.color} / ${line.size}"),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(onPressed: () => ref.read(bagControllerProvider.notifier).setQty(line.key, line.qty - 1), icon: const Icon(Icons.remove)),
                Text("${line.qty}"),
                IconButton(onPressed: () => ref.read(bagControllerProvider.notifier).setQty(line.key, line.qty + 1), icon: const Icon(Icons.add)),
                Text(inr(line.lineTotal)),
              ],
            ),
          ),
        const Divider(),
        Text("Subtotal ${inr(total)}"),
        Text(total >= 2500 ? "Shipping complimentary" : "Shipping ₹149"),
      ],
    );
  }
}

class TrialView extends ConsumerStatefulWidget {
  const TrialView({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<TrialView> createState() => _TrialViewState();
}

class _TrialViewState extends ConsumerState<TrialView> {
  double height = 168;
  double chest = 88;
  bool consent = false;
  bool pending = false;
  String message = "";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Trial-View")),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(widget.product.name, style: const TextStyle(fontSize: 28)),
          Text("Height ${height.round()} cm"),
          Slider(value: height, min: 140, max: 200, onChanged: (value) => setState(() => height = value)),
          Text("Chest ${chest.round()} cm"),
          Slider(value: chest, min: 60, max: 130, onChanged: (value) => setState(() => chest = value)),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: consent,
            onChanged: (value) => setState(() => consent = value ?? false),
            title: const Text("I consent to a private preview. Inference files are removed when it returns, and within 24 hours otherwise."),
          ),
          FilledButton(
            onPressed: !consent || pending
                ? null
                : () async {
                    setState(() {
                      pending = true;
                      message = "";
                    });
                    try {
                      final result = await getIt<ShopRepository>().tryOnTwin(
                        slug: widget.product.slug,
                        color: widget.product.colors.first.name,
                        height: height,
                        chest: chest,
                        waist: chest * 0.82,
                        hips: chest * 1.08,
                      );
                      setState(() => message = "Draped in ${result["latency_ms"]} ms with ${result["physics"]["fold_count"]} folds.");
                    } catch (error) {
                      setState(() => message = error.toString());
                    } finally {
                      setState(() => pending = false);
                    }
                  },
            child: Text(pending ? "Draping…" : "Try it on me"),
          ),
          if (message.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(message)),
        ],
      ),
    );
  }
}

class AccountView extends ConsumerStatefulWidget {
  const AccountView({super.key});

  @override
  ConsumerState<AccountView> createState() => _AccountViewState();
}

class _AccountViewState extends ConsumerState<AccountView> {
  final email = TextEditingController(text: "mira@sutra.test");
  final password = TextEditingController(text: "loom-and-line");
  String status = "Preview account is filled in.";

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text("Account", style: TextStyle(fontSize: 32)),
        const SizedBox(height: 12),
        TextField(controller: email, decoration: const InputDecoration(labelText: "Email")),
        TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: "Password")),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () async {
            try {
              final result = await getIt<ShopRepository>().login(email.text.trim(), password.text);
              final token = result["token"] as String?;
              if (token != null) getIt<ApiClient>().token = token;
              final name = (result["user"] as Map)["name"];
              setState(() => status = "Signed in as $name.");
            } catch (error) {
              setState(() => status = error.toString());
            }
          },
          child: const Text("Sign in"),
        ),
        const SizedBox(height: 12),
        Text("${ref.watch(bagControllerProvider).length} in the bag. $status"),
      ],
    );
  }
}

Color _parseHex(String hex) {
  final value = hex.replaceFirst("#", "");
  return Color(int.parse("FF$value", radix: 16));
}
