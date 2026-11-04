import Link from "next/link";
import { Icon } from "../Icon";
export function SectionHeader({ title, link, linkLabel = "View All" }: { title: string; link?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-xl font-semibold lg:text-[22px]">{title}</h2>
      {link && <Link href={link} className="flex items-center gap-2 whitespace-nowrap text-sm font-medium hover:text-primary">{linkLabel} <Icon name="arrowRight" size={16} /></Link>}
    </div>
  );
}
