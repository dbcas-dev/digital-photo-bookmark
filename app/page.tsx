// app/page.tsx
import { Metadata } from 'next';
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MainUI from "./components/MainUI";
import { searchPhotoRecords } from "@/app/actions/photoActions";

type Props = {
  // In Next.js 15, these MUST be Promises
  params: Promise<{ [key: string]: string }>;
  searchParams: Promise<{ c?: string; s?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // FIX #1: Await the searchParams immediately
  const { c: code } = await searchParams;
  const siteUrl = "https://dbcas.vercel.app";

  if (code) {
    try {
      const result = await searchPhotoRecords(code);
      if (result.success && result.data.length > 0) {
        const record = result.data[0];
        const imageUrl = record.thumb_url;

        return {
          // FIX #2: Explicitly set metadataBase to resolve relative paths
          metadataBase: new URL(siteUrl),
          title: `${record.photo_code} | ${record.album_name} - Capture and Share`,
          description: `Album: ${record.album_name} - Capture and Share - Digital Image Sharing`,
          openGraph: {
            title: `${record.photo_code} | ${record.album_name} - Capture and Share`,
            description: `Album: ${record.album_name} - Capture and Share - Digital Image Sharing`,
            url: `/?c=${code}`,
            siteName: 'DBCAS',
            // FIX #3: Use absolute URL and specify dimensions
            images: [
              {
                url: imageUrl, 
                width: 1200,
                height: 630,
              },
            ],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            title: `${record.photo_code} | ${record.album_name} - Capture and Share`,
            description: `Album: ${record.album_name} - Capture and Share - Digital Image Sharing`,
            images: [imageUrl],
          },
        };
      }
    } catch (e) {
      console.error("Metadata fetch error:", e);
    }
  }

  // Default Fallback
  return {
    metadataBase: new URL(siteUrl),
    title: 'Capture and Share - Digital Image Sharing made better!',
    description: 'Digital Image Sharing made better!',
    openGraph: {
      images: ['/og-image.jpg'], // Make sure this file exists in your /public folder!
    },
  };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <MainUI />
    </Suspense>
  );
}
