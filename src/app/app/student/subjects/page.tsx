import { redirect } from "next/navigation";

export const metadata = { title: "موادي" };
export default function StudentSubjectsPage() { redirect("/app/student/grades"); }
