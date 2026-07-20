import { redirect } from "next/navigation";

/** Discovery now lives at the root; keep this path working for old links. */
export default function Discover() {
  redirect("/");
}
