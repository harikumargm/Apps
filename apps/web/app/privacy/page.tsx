export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="page max-w-3xl py-10">
      <p className="eyebrow">Privacy</p>
      <h1 className="serif text-6xl">Your body is not a dataset.</h1>
      <div className="mt-8 grid gap-5 text-[17px] leading-relaxed">
        <p>Sutra stores account details you give us: name, email or phone, shipping address, measurements, and orders. Passwords are hashed. Deleting an account removes the profile and anonymises past orders.</p>
        <p>Photographs uploaded for Trial-View are spilled to an inference scratch directory only if a stage must touch disk. They are deleted when the preview is returned. A sweeper removes anything older than 24 hours, so a crashed worker cannot keep a body photo.</p>
        <p>A checkbox can record that you would allow training. This build has no training export. The preference is stored; the pixels are not added to a public model.</p>
        <p>Previews you explicitly save to your profile stay in application storage until you delete them or delete the account. They are separate from the inference server.</p>
        <p>Payments in this demo create Stripe, Razorpay, or UPI intents and do not send card data to a live processor.</p>
        <p>Questions: privacy@sutra.example.</p>
      </div>
    </div>
  );
}
