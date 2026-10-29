import "package:flutter_test/flutter_test.dart";
import "package:sutra/domain/models/product.dart";

void main() {
  test("merging the same size and colour adds quantity", () {
    const line = CartLine(
      productId: "p_indigo_shirt",
      slug: "indigo-poplin-shirt",
      name: "Indigo Poplin Shirt",
      size: "M",
      color: "Indigo",
      hex: "#1d3557",
      silhouette: "shirt",
      qty: 1,
      unitPrice: 3490,
    );
    final merged = mergeLines([line], line.copyWith(qty: 2));
    expect(merged, hasLength(1));
    expect(merged.single.qty, 3);
    expect(merged.single.lineTotal, 10470);
  });
}
