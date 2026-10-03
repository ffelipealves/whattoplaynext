import { SiteHeader } from "@/features/search/site-header";
import { SystemNotFound } from "@/features/system/system-not-found";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <SystemNotFound kind="page" />
    </>
  );
}
