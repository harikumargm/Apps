import { Navigate, useParams } from "react-router-dom";
import { Pdp } from "@/components/pdp";
import { productBySlug, relatedTo } from "@/lib/catalog";

export default function ProductPage() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/catalog" replace />;
  const product = productBySlug(slug);
  if (!product) return <Navigate to="/catalog" replace />;
  return <Pdp product={product} related={relatedTo(product)} />;
}
