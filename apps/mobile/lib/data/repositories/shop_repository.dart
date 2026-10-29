import "../../domain/models/product.dart";
import "../services/api_client.dart";

class ShopRepository {
  ShopRepository(this._api);

  final ApiClient _api;

  Future<List<Product>> products({String? audience, String? occasion, String? fabric}) async {
    final query = [
      if (audience != null && audience.isNotEmpty) "audience=$audience",
      if (occasion != null && occasion.isNotEmpty) "occasion=$occasion",
      if (fabric != null && fabric.isNotEmpty) "fabric=${Uri.encodeQueryComponent(fabric)}",
    ].join("&");
    final path = query.isEmpty ? "/v1/products" : "/v1/products?$query";
    final body = await _api.getJson(path);
    return (body["items"] as List).map((row) => Product.fromJson(row as Map<String, dynamic>)).toList();
  }

  Future<List<CartLine>> saveCart(List<CartLine> lines) async {
    final body = await _api.send("/v1/cart", method: "PUT", body: {"items": lines.map((line) => line.toRequest()).toList()});
    return (body["items"] as List).map((row) => CartLine.fromJson(row as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> login(String email, String password) {
    return _api.send("/v1/auth/login", method: "POST", body: {"email": email, "password": password});
  }

  Future<Map<String, dynamic>> tryOnTwin({
    required String slug,
    required String color,
    required double height,
    required double chest,
    required double waist,
    required double hips,
  }) {
    return _api.send("/v1/tryon/twin", method: "POST", body: {
      "product_slug": slug,
      "color": color,
      "height_cm": height,
      "chest_cm": chest,
      "waist_cm": waist,
      "hips_cm": hips,
      "consent": true,
    });
  }
}
