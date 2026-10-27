import { VendorScan } from "@/components/vendor-scan";

export const metadata = { title: "Fabric scan" };

export default function VendorPage() {
  return (
    <div className="page py-10">
      <p className="eyebrow">Vendor studio</p>
      <h1 className="serif max-w-3xl text-6xl">Read a cloth.</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Upload a garment photograph or a close-up of the weave. The vision service returns fibre hypotheses, weave, weight, stretch, and care. Treat composition as an estimate unless you also hold the mill spec.
      </p>
      <div className="mt-8">
        <VendorScan />
      </div>
    </div>
  );
}
