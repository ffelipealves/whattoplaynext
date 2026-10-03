import { SiteHeader } from "@/features/search/site-header";

export default function HeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
