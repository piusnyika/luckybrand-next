"use client";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { Icon } from "../Icon";
export function MobileBottomBar() {
  const { count, wishlist, setDrawerOpen, ready } = useCart();
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink";
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-line bg-white lg:hidden">
      <Link href="/" className={item}><Icon name="home" size={22} />Home</Link>
      <Link href="/shop/" className={item}><Icon name="grid" size={22} />Shop</Link>
      <Link href="/wishlist/" className={`${item} relative`}><Icon name="heart" size={22} />Wishlist{ready && wishlist.length > 0 && <span className="absolute right-[28%] top-1 rounded-full bg-primary px-1.5 text-[10px] text-white">{wishlist.length}</span>}</Link>
      <button type="button" onClick={() => setDrawerOpen(true)} className={`${item} relative`}><Icon name="bag" size={22} />Cart{ready && count > 0 && <span className="absolute right-[28%] top-1 rounded-full bg-primary px-1.5 text-[10px] text-white">{count}</span>}</button>
      <Link href="/my-account/" className={item}><Icon name="user" size={22} />Account</Link>
    </nav>
  );
}
