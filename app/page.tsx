// app/page.tsx
import { Metadata } from 'next';
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MainUI from "./components/MainUI";
import { searchPhotoRecords } from "@/app/actions/photoActions";

type Props = {
  searchParams: Promise<{ c?: string; s?: string }>; // Next.js 15 requires searchParams to be a Promise
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { c: code } = await searchParams;
  const siteUrl = "https://dbcas.vercel.app"; // No trailing slash needed if using metadataBase

  // Default fallback image if record has no thumb_url or for the home page
  const defaultImage = "/default-og-image.jpg"; 

  if (code) {
    const result = await searchPhotoRecords(code);
    if (result.success && result.data.length > 0) {
      const record = result.data[0];
      
      return {
        metadataBase: new URL(siteUrl),
        title: `Verified: ${record.photo_code}`,
        description: `View album: ${record.album_name}`,
        openGraph: {
          title: `Verified Image: ${record.photo_code}`,
          description: `Album: ${record.album_name} | Verified via DBCAS`,
          url: `/?c=${code}`,
          siteName: 'DBCAS Digital',
          images: [
            {
              url: record.thumb_url, // Full URL from your DB/Cloudinary/S3
              width: 1200,
              height: 630,
              alt: `Preview of ${record.photo_code}`,
            },
          ],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `Verified: ${record.photo_code}`,
          description: `Album: ${record.album_name}`,
          images: [record.thumb_url],
        },
      };
    }
  }

  // Default SEO
  return {
    metadataBase: new URL(siteUrl),
    title: 'Capture and Share - Digital Image Sharing',
    description: 'Digital Image Sharing made better!',
    openGraph: {
      title: 'Capture and Share',
      description: 'Digital Image Sharing made better!',
      images: [defaultImage],
    },
  };
}
