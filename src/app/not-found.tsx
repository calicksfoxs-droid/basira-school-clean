import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() { return <main className="grid min-h-screen place-items-center bg-[#f7f4ec] p-6"><EmptyState title="الصفحة غير موجودة" description="قد يكون الرابط قديمًا أو لا تملك صلاحية الوصول إليه." action={<Link href="/app" className="focus-ring inline-flex min-h-12 items-center rounded-xl bg-[#173b63] px-5 font-bold text-white">العودة إلى الرئيسية</Link>}/></main>; }
