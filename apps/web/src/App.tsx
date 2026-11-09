import { Route, Routes } from "react-router-dom";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import HomePage from "@/app/page";
import NotFound from "@/app/not-found";
import CatalogPage from "@/app/catalog/page";
import ActivewearPage from "@/app/catalog/activewear/page";
import SportwearPage from "@/app/catalog/sportwear/page";
import ProductPage from "@/app/product/[slug]/page";
import CartPage from "@/app/cart/page";
import CheckoutPage from "@/app/checkout/page";
import AccountPage from "@/app/account/page";
import OrderPage from "@/app/orders/[id]/page";
import TrialPage from "@/app/trial/page";
import VendorPage from "@/app/vendor/page";
import PrivacyPage from "@/app/privacy/page";

export function App() {
  return (
    <Providers>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/activewear" element={<ActivewearPage />} />
          <Route path="/catalog/sportwear" element={<SportwearPage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="/trial" element={<TrialPage />} />
          <Route path="/vendor" element={<VendorPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </Providers>
  );
}
