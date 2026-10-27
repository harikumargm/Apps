import { CheckoutForm } from "@/components/checkout-form";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="page py-10">
      <h1 className="serif mb-8 text-6xl">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
