import { redirect } from "next/navigation";

export const metadata = { title: "موادي" };

export default function TeacherSubjectsPage() { redirect("/app/teacher/grades"); }
