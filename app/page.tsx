// app/page.tsx
import { Metadata } from 'next';
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MainUI from "./components/MainUI";
import { searchPhotoRecords } from "@/app/actions/photoActions";
import { getBatchAlbums } from "@/app/actions/batchActions"; // Import this

type Props = {
  params: Promise<{ [key: string]: string }>;
  searchParams: Promise<{ c?: string; s?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { c: code } = await searchParams;
  const siteUrl = "https://dbcas.vercel.app";

  if (code) {
    try {
      // 1. Try searching for a specific Photo Record first
      const photoResult = await searchPhotoRecords(code);
      
      if (photoResult.success && photoResult.data.length > 0) {
        const record = photoResult.data[0];
        const imageUrl = record.thumb_url;

        return {
          metadataBase: new URL(siteUrl),
          title: `${record.photo_code} | ${record.album_name}`,
          description: `View photo ${record.photo_code} from ${record.album_name}.`,
          openGraph: {
            title: `${record.photo_code} | ${record.album_name}`,
            description: `Digital Image Sharing - ${record.album_name}`,
            url: `/?c=${code}`,
            images: [{ url: imageUrl, width: 1200, height: 630 }],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            images: [imageUrl],
          },
        };
      }

      // 2. If no photo found, try searching for a Batch/Album
      const batchResult = await getBatchAlbums();
      if (batchResult?.success && Array.isArray(batchResult.data)) {
        const album = batchResult.data.find((b: any) => 
          b.album_code.toUpperCase() === code.toUpperCase()
        );

if (album) {
          // Use thumb_url if it exists, otherwise fallback to default OG image
          const albumImg = album.thumb_url || '/og-image.jpg';
          
          return {
            metadataBase: new URL(siteUrl),
            title: `${album.title} | Album`,
            description: `View the full album: ${album.title}`,
            openGraph: {
              title: album.title,
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
