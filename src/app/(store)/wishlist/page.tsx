import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { WishlistView } from "@/components/store/SavedList";
export const metadata = { title: "Wishlist", robots: { index: false } };
export default function Wishlist() { return <div className="container"><Breadcrumbs items={[{ label: "Wishlist" }]} /><h1 className="mb-6 text-2xl font-semibold">Wishlist</h1><WishlistView /></div>; }
