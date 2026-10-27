import { OrderView } from "@/components/order-view";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="page py-10">
      <OrderView id={id} />
    </div>
  );
}
