// app/page.tsx
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { c: code } = await searchParams; // Await for Next.js 15+ compatibility
  const siteUrl = "https://dbcas.vercel.app";

  if (code) {
    const result = await searchPhotoRecords(code);
    
    if (result.success && result.data.length > 0) {
      const record = result.data[0];
      const imageUrl = record.thumb_url; // Directly using your DB field name

      return {
        metadataBase: new URL(siteUrl),
        title: `Verified: ${record.photo_code}`,
        description: `Album: ${record.album_name}`,
        openGraph: {
          title: `Verified Image: ${record.photo_code}`,
          description: `Album: ${record.album_name} | Click to view details.`,
          url: `/?c=${code}`,
          siteName: 'DBCAS Digital',
          images: [
            {
              url: imageUrl,
              width: 1200, // Standard OG width
              height: 630, // Standard OG height
              alt: `Preview of ${record.photo_code}`,
            },
          ],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image', // This makes the image big and clickable on X
          title: `Verified: ${record.photo_code}`,
          description: `Album: ${record.album_name}`,
          images: [imageUrl],
        },
      };
    }
  }

  // Fallback for home page
  return {
    metadataBase: new URL(siteUrl),
    title: 'Capture and Share - Digital Image Sharing',
    description: 'Digital Image Sharing made better!',
    openGraph: {
      images: ['/og-fallback.jpg'], // Make sure this exists in your /public folder
    },
  };
}
