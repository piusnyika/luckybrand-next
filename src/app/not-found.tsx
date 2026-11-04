import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center font-sans">
      <div className="text-7xl font-bold text-primary">404</div>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-ink-soft">The page you are looking for doesn’t exist or has moved.</p>
      <div className="flex gap-3"><Link href="/" className="btn-primary">Go home</Link><Link href="/shop/" className="btn-outline">Browse the shop</Link></div>
    </div>
  );
}
