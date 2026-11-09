import { AccountPanel } from "@/components/account-panel";

export default function AccountPage() {
  return (
    <div className="page py-10">
      <p className="eyebrow">Profile</p>
      <h1 className="serif mb-8 text-6xl">Your measurements, your orders.</h1>
      <AccountPanel />
    </div>
  );
}
