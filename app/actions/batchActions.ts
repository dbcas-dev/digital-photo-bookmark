"use server";

import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

/**
 * Save a new Batch Album record
 */
export async function saveBatchAlbum(data: { 
  title: string, 
  shareLink: string, 
  thumbUrl: string, 
  albumCode: string 
}) {
  try {
    await client.execute({
      sql: "INSERT INTO batch_albums (title, share_link, thumb_url, album_code) VALUES (?, ?, ?, ?)",
      args: [
        data.title, 
        data.shareLink, 
        data.thumbUrl, 
        data.albumCode.toUpperCase()
      ]
    });
    return { success: true };
  } catch (error) {
    console.error("Turso Save Error:", error);
    return { success: false, error };
  }
}

/**
 * Fetch all Batch Albums ordered by newest first
 */
export async function getBatchAlbums() {
  try {
    const result = await client.execute("SELECT * FROM batch_albums ORDER BY created_at DESC");
    
    // Mapping rows to ensure property names match your frontend expectations
    const data = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      share_link: row.share_link,
      thumb_url: row.thumb_url,
      album_code: row.album_code,
      created_at: row.created_at
    }));
    
    return { success: true, data };
  } catch (error) {
    console.error("Turso Fetch Error:", error);
    return { success: false, error };
  }
}

/**
 * Update an existing Batch Album
 */
export async function updateBatchAlbum(
  id: string | number, 
  data: { title: string, shareLink: string, thumbUrl: string, albumCode: string }
) {
  try {
    await client.execute({
      sql: "UPDATE batch_albums SET title = ?, share_link = ?, thumb_url = ?, album_code = ? WHERE id = ?",
      args: [
        data.title, 
        data.shareLink, 
        data.thumbUrl, 
        data.albumCode.toUpperCase(), 
        id
      ]
    });
    return { success: true };
  } catch (error) {
    console.error("Turso Update Error:", error);
    return { success: false, error };
  }
}

/**
 * Delete a Batch Album record
 */
export async function deleteBatchAlbum(id: string | number) {
  try {
    await client.execute({
      sql: "DELETE FROM batch_albums WHERE id = ?",
      args: [id]
    });
    return { success: true };
  } catch (error) {
    console.error("Turso Delete Error:", error);
    return { success: false, error };
  }
}