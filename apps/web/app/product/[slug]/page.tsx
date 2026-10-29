import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pdp } from "@/components/pdp";
import { productBySlug, products, relatedTo } from "@/lib/catalog";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  return { title: product?.name ?? "Piece", description: product?.summary };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();
  return <Pdp product={product} related={relatedTo(product)} />;
}
