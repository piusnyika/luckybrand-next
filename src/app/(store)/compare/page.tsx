import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CompareView } from "@/components/store/SavedList";
export const metadata = { title: "Compare", robots: { index: false } };
export default function Compare() { return <div className="container"><Breadcrumbs items={[{ label: "Compare" }]} /><h1 className="mb-6 text-2xl font-semibold">Compare products</h1><CompareView /></div>; }
