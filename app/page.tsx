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
  const { c: code, s: search } = await searchParams;
  const query = code || search;
  const siteUrl = "https://dbcas.vercel.app";

  if (query) {
    try {
      // 1. Clean the query using the same logic as the client side
      let cleanQuery = query.trim().toUpperCase();
      const dashlessPattern = /^([A-Z]{2})(\d{4})(\d{4})$/;
      if (dashlessPattern.test(cleanQuery)) {
        cleanQuery = cleanQuery.replace(dashlessPattern, '$1-$2-$3');
      }

      // 2. Fetch Photos
      const photoResult = await searchPhotoRecords(cleanQuery);
      const foundPhotos = photoResult?.success ? (photoResult.data as any[]) : [];

      // 3. Fetch Batches/Albums
      const batchResult = await getBatchAlbums();
      let matchedBatches: any[] = [];
      
      if (batchResult?.success && Array.isArray(batchResult.data)) {
        matchedBatches = (batchResult.data as any[])
          .filter((b: any) => {
            const searchNormalized = cleanQuery.replace(/\s/g, '');
            const titleMatch = b.title?.toUpperCase().includes(cleanQuery);
            const codeMatch = b.album_code?.toUpperCase().includes(searchNormalized);
            return titleMatch || codeMatch;
          });
      }

      // 4. Combine results (Batches first, then photos - mirroring client UI)
      const allResults = [...matchedBatches, ...foundPhotos];

      if (allResults.length > 0) {
        // Grab the first record to use its thumbnail
        const firstRecord = allResults[0];
        const imageUrl = firstRecord.thumb_url || '/og-image.jpg';
        
        // Define title dynamically
        // If it's a search, use the search query. If direct code, use the specific format.
        const pageTitle = search 
          ? `${cleanQuery} | Capture and Share - Digital Image Sharing` 
          : `${firstRecord.photo_code || firstRecord.album_code} | ${firstRecord.album_name || firstRecord.title || 'Photo'}`;

        return {
          metadataBase: new URL(siteUrl),
          title: pageTitle,
          description: search ? `View search results for ${cleanQuery}` : `View photo ${cleanQuery} - Digital Image Sharing`,
          openGraph: {
            title: pageTitle,
            description: search ? `Search results for ${cleanQuery}` : `Digital Image Sharing`,
            url: search ? `/?s=${encodeURIComponent(cleanQuery)}` : `/?c=${cleanQuery}`,
            images: [{ url: String(imageUrl), width: 1200, height: 630 }],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            images: [String(imageUrl)],
          },
        };
      }
    } catch (e) {
      console.error("Metadata fetch error:", e);
    }
  }

  // Default Fallback (No query, or query yielded 0 results)
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>}>
      <MainUI />
    </Suspense>
  );
}
