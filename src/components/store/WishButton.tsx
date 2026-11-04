"use client";
import { useCart } from "./CartProvider";
import { Icon } from "../Icon";
export function WishButton({ id, className = "" }: { id: number; className?: string }) {
  const { wishlist, toggleWish, ready } = useCart();
  const on = ready && wishlist.includes(id);
  return (
    <button type="button" aria-label={on ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWish(id)}
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white transition hover:border-primary hover:text-primary ${on ? "text-danger" : "text-ink"} ${className}`}>
      <Icon name="heart" size={16} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
