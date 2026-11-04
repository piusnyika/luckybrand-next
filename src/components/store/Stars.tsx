/** Star rating (0–5, halves rounded), e.g. on product pages and cards */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-500 ${className}`} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = full >= i ? "full" : full >= i - 0.5 ? "half" : "none";
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
            <defs><linearGradient id={`h${size}`}><stop offset="50%" stopColor="currentColor" /><stop offset="50%" stopColor="#d9dce0" /></linearGradient></defs>
            <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"
              fill={fill === "full" ? "currentColor" : fill === "half" ? `url(#h${size})` : "#d9dce0"} />
          </svg>
        );
      })}
    </span>
  );
}
