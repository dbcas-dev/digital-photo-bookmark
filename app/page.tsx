// app/page.tsx
import { Metadata } from 'next';
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MainUI from "./components/MainUI"; // Dito natin tatawagin yung UI mo
import { searchPhotoRecords } from "@/app/actions/photoActions";

type Props = {
  searchParams: { c?: string; s?: string };
};

// ETO YUNG AUTOMATIC THUMBNAIL LOGIC
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const code = searchParams.c;
  const siteUrl = "https://yourdomain.com"; // PALITAN MO ITO NG LIVE URL MO

  if (code) {
    const result = await searchPhotoRecords(code);
    if (result.success && result.data.length > 0) {
      const record = result.data[0];
      return {
        title: `Verified: ${record.photo_code}`,
        openGraph: {
          title: `Verified Image: ${record.photo_code}`,
          description: `Album: ${record.album_name}`,
          url: `${siteUrl}/?c=${code}`,
          images: [{ url: record.thumb_url }], // ETO YUNG LALABAS NA PICTURE SA FB
          type: 'website',
        },
      };
    }
  }

  // Default SEO pag walang sine-search
  return {
    title: 'Photobooth Verification System',
    description: 'Verify and download your digital bookmarks.',
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <MainUI />
    </Suspense>
  );
}