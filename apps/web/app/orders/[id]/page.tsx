import { useParams } from "react-router-dom";
import { OrderView } from "@/components/order-view";

export default function OrderPage() {
  const { id } = useParams();
  return (
    <div className="page py-10">
      <OrderView id={id ?? ""} />
    </div>
  );
}
