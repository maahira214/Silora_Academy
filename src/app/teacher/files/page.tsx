import { redirect } from "next/navigation";

// Files now live inside each conversation (Messages → a chat → Files).
export default function Page() {
  redirect("/teacher/messages");
}
