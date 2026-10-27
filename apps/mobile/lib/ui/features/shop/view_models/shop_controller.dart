import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../../data/repositories/shop_repository.dart";
import "../../../../di.dart";
import "../../../../domain/models/product.dart";

class ShopState {
  const ShopState({this.products = const [], this.loading = false, this.error = ""});

  final List<Product> products;
  final bool loading;
  final String error;

  ShopState copyWith({List<Product>? products, bool? loading, String? error}) {
    return ShopState(products: products ?? this.products, loading: loading ?? this.loading, error: error ?? this.error);
  }
}

class ShopController extends Notifier<ShopState> {
  @override
  ShopState build() {
    Future.microtask(load);
    return const ShopState(loading: true);
  }

  Future<void> load({String? audience, String? occasion, String? fabric}) async {
    state = state.copyWith(loading: true, error: "");
    try {
      final items = await getIt<ShopRepository>().products(audience: audience, occasion: occasion, fabric: fabric);
      state = state.copyWith(products: items, loading: false);
    } catch (error) {
      state = state.copyWith(loading: false, error: error.toString());
    }
  }
}

final shopControllerProvider = NotifierProvider<ShopController, ShopState>(ShopController.new);

class BagController extends Notifier<List<CartLine>> {
  @override
  List<CartLine> build() => [];

  Future<void> add(CartLine line) async {
    final next = mergeLines(state, line);
    state = next;
    try {
      state = await getIt<ShopRepository>().saveCart(next);
    } catch (_) {
      state = next;
    }
  }

  void setQty(String key, int qty) {
    state = [
      for (final line in state)
        if (line.key != key) line else if (qty > 0) line.copyWith(qty: qty),
    ];
  }
}

final bagControllerProvider = NotifierProvider<BagController, List<CartLine>>(BagController.new);
