import { redirect } from "next/navigation";

// Teachers and students share one page now.
export default function Page() {
  redirect("/admin/people?role=teachers");
}
