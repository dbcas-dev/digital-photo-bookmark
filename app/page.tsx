// app/page.tsx
import { Metadata } from 'next';
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MainUI from "./components/MainUI";
import { searchPhotoRecords } from "@/app/actions/photoActions";
import { getBatchAlbums } from "@/app/actions/batchActions";

type Props = {
  params: Promise<{ [key: string]: string }>;
  searchParams: Promise<{ c?: string; s?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { c: code } = await searchParams;
  const siteUrl = "https://dbcas.vercel.app";

  if (code) {
    try {
      // 1. Try Photo Record Search
      const photoResult = await searchPhotoRecords(code);
      
      // Cast to any to prevent property-not-found errors during build
      const photoData = photoResult?.success ? (photoResult.data as any[]) : [];

      if (photoData.length > 0) {
        const record = photoData[0];
        const imageUrl = record.thumb_url || '/og-image.jpg';

        return {
          metadataBase: new URL(siteUrl),
          title: `${record.photo_code} | ${record.album_name || 'Photo'}`,
          description: `View photo ${record.photo_code} - Digital Image Sharing`,
          openGraph: {
            title: `${record.photo_code} | ${record.album_name || 'Photo'}`,
            description: `Digital Image Sharing`,
            url: `/?c=${code}`,
            images: [{ url: String(imageUrl), width: 1200, height: 630 }],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            images: [String(imageUrl)],
          },
        };
      }

      // 2. Try Batch/Album Search
      const batchResult = await getBatchAlbums();
      if (batchResult?.success && Array.isArray(batchResult.data)) {
        // Cast b to any to avoid property errors on thumb_url or title
        const album = (batchResult.data as any[]).find((b: any) => 
          b.album_code?.toUpperCase() === code.toUpperCase()
        );

        if (album) {
          const albumImg = album.thumb_url || '/og-image.jpg';
          
          return {
            metadataBase: new URL(siteUrl),
            title: `${album.title || 'Album'} | Digital Sharing`,
            description: `View the full album: ${album.title || album.album_code}`,
            openGraph: {
              title: album.title || album.album_code,
              description: `Digital Album - ${album.album_code}`,
              url: `/?c=${code}`,
              images: [{ url: String(albumImg), width: 1200, height: 630 }],
              type: 'website',
            },
          };
        }
      }
    } catch (e) {
      console.error("Metadata fetch error:", e);
    }
  }

  // Default Fallback
  return {
    metadataBase: new URL(siteUrl),
    title: 'Capture and Share - Digital Image Sharing',
    description: 'Digital Image Sharing made better!',
    openGraph: {
      images: ['/og-image.jpg'],
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
