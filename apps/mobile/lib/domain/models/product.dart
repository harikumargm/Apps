class FiberShare {
  const FiberShare({required this.fiber, required this.percent});

  final String fiber;
  final int percent;

  factory FiberShare.fromJson(Map<String, dynamic> json) {
    return FiberShare(fiber: json["fiber"] as String, percent: (json["percent"] as num).toInt());
  }
}

class FabricInfo {
  const FabricInfo({
    required this.type,
    required this.composition,
    required this.weave,
    required this.weight,
    required this.stretchIndex,
    required this.care,
    required this.millNote,
  });

  final String type;
  final List<FiberShare> composition;
  final String weave;
  final String weight;
  final int stretchIndex;
  final List<String> care;
  final String millNote;

  factory FabricInfo.fromJson(Map<String, dynamic> json) {
    return FabricInfo(
      type: json["type"] as String,
      composition: (json["composition"] as List).map((row) => FiberShare.fromJson(row as Map<String, dynamic>)).toList(),
      weave: json["weave"] as String,
      weight: json["weight"] as String,
      stretchIndex: (json["stretch_index"] as num).toInt(),
      care: (json["care"] as List).map((item) => item as String).toList(),
      millNote: json["mill_note"] as String? ?? "",
    );
  }

  String get compositionLabel => composition.map((row) => "${row.percent}% ${row.fiber}").join(" · ");
}

class Colorway {
  const Colorway({required this.name, required this.hex});

  final String name;
  final String hex;

  factory Colorway.fromJson(Map<String, dynamic> json) {
    return Colorway(name: json["name"] as String, hex: json["hex"] as String);
  }
}

class Product {
  const Product({
    required this.id,
    required this.slug,
    required this.name,
    required this.audience,
    required this.occasion,
    required this.price,
    required this.silhouette,
    required this.summary,
    required this.colors,
    required this.sizes,
    required this.fabric,
    this.image,
  });

  final String id;
  final String slug;
  final String name;
  final String audience;
  final String occasion;
  final int price;
  final String silhouette;
  final String summary;
  final String? image;
  final List<Colorway> colors;
  final List<String> sizes;
  final FabricInfo fabric;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json["id"] as String,
      slug: json["slug"] as String,
      name: json["name"] as String,
      audience: json["audience"] as String,
      occasion: json["occasion"] as String,
      price: (json["price"] as num).toInt(),
      silhouette: json["silhouette"] as String,
      summary: json["summary"] as String,
      colors: (json["colors"] as List).map((row) => Colorway.fromJson(row as Map<String, dynamic>)).toList(),
      sizes: (json["sizes"] as List).map((row) => row as String).toList(),
      fabric: FabricInfo.fromJson(json["fabric"] as Map<String, dynamic>),
      image: json["image"] as String?,
    );
  }
}

class CartLine {
  const CartLine({
    required this.productId,
    required this.slug,
    required this.name,
    required this.size,
    required this.color,
    required this.hex,
    required this.silhouette,
    required this.qty,
    required this.unitPrice,
  });

  final String productId;
  final String slug;
  final String name;
  final String size;
  final String color;
  final String hex;
  final String silhouette;
  final int qty;
  final int unitPrice;

  int get lineTotal => unitPrice * qty;

  CartLine copyWith({int? qty}) => CartLine(
        productId: productId,
        slug: slug,
        name: name,
        size: size,
        color: color,
        hex: hex,
        silhouette: silhouette,
        qty: qty ?? this.qty,
        unitPrice: unitPrice,
      );

  String get key => "$productId|$size|$color";

  Map<String, dynamic> toRequest() => {
        "product_id": productId,
        "size": size,
        "color": color,
        "qty": qty,
      };

  factory CartLine.fromJson(Map<String, dynamic> json) {
    return CartLine(
      productId: json["product_id"] as String,
      slug: json["slug"] as String,
      name: json["name"] as String,
      size: json["size"] as String,
      color: json["color"] as String,
      hex: json["hex"] as String,
      silhouette: json["silhouette"] as String,
      qty: (json["qty"] as num).toInt(),
      unitPrice: (json["unit_price"] as num).toInt(),
    );
  }
}

List<CartLine> mergeLines(List<CartLine> current, CartLine incoming) {
  final index = current.indexWhere((line) => line.key == incoming.key);
  if (index < 0) return [...current, incoming];
  final next = [...current];
  final qty = (next[index].qty + incoming.qty).clamp(1, 8);
  next[index] = next[index].copyWith(qty: qty);
  return next;
}
