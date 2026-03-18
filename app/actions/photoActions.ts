"use server";

import { db } from "@/lib/db";

// 1. Save a new record
export async function savePhotoRecord(data: {
  albumName: string;
  shareLink: string;
  thumbUrl: string;
}) {
  try {
    const words = data.albumName.trim().split(/\s+/);
    let abbrev = "";
    if (words.length >= 2) {
      abbrev = (words[0][0] + words[1][0]).toUpperCase();
    } else {
      abbrev = data.albumName.substring(0, 2).toUpperCase();
    }
    const year = new Date().getFullYear();

    const result = await db.execute({
      sql: "SELECT MAX(serial_number) as lastSerial FROM photo_records WHERE album_name = ?",
      args: [data.albumName],
    });

    const lastSerial = (result.rows[0]?.lastSerial as number) || 0;
    const newSerial = lastSerial + 1;
    const formattedSerial = String(newSerial).padStart(4, "0");
    const photoCode = `${abbrev}-${year}-${formattedSerial}`;

    await db.execute({
      sql: `INSERT INTO photo_records (album_name, share_link, thumb_url, photo_code, serial_number) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [data.albumName, data.shareLink, data.thumbUrl, photoCode, newSerial],
    });

    return { success: true, photoCode };
  } catch (error) {
    console.error("Database Error:", error);
    return { success: false, error: "Failed to save record" };
  }
}

// 2. Fetch all records (Clean version to avoid the "Plain Object" error)
export async function getPhotoRecords() {
  try {
    const result = await db.execute("SELECT * FROM photo_records ORDER BY created_at DESC");
    
    const cleanData = result.rows.map((row) => ({
      id: Number(row.id),
      album_name: String(row.album_name),
      share_link: String(row.share_link),
      thumb_url: String(row.thumb_url),
      photo_code: String(row.photo_code),
      serial_number: Number(row.serial_number),
      created_at: String(row.created_at),
    }));

    return { success: true, data: cleanData };
  } catch (error) {
    console.error("Fetch Error:", error);
    return { success: false, data: [] };
  }
}

// 3. Delete a record
export async function deletePhotoRecord(id: number) {
  try {
    await db.execute({
      sql: "DELETE FROM photo_records WHERE id = ?",
      args: [id],
    });
    return { success: true };
  } catch (error) {
    console.error("Delete Error:", error);
    return { success: false };
  }
}

// 4. Update an existing record
export async function updatePhotoRecord(id: number, data: {
  albumName: string;
  shareLink: string;
  thumbUrl: string;
}) {
  try {
    await db.execute({
      sql: `UPDATE photo_records 
            SET album_name = ?, share_link = ?, thumb_url = ? 
            WHERE id = ?`,
      args: [data.albumName, data.shareLink, data.thumbUrl, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Update Error:", error);
    return { success: false };
  }
}

// 5. Search for a photo by Code or Album Name
export async function searchPhotoRecords(query: string) {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM photo_records 
            WHERE photo_code = ? 
            OR album_name LIKE ? 
            ORDER BY created_at DESC`,
      args: [query, `%${query}%`],
    });

    const cleanData = result.rows.map((row) => ({
      id: Number(row.id),
      album_name: String(row.album_name),
      share_link: String(row.share_link),
      thumb_url: String(row.thumb_url),
      photo_code: String(row.photo_code),
      created_at: String(row.created_at),
    }));

    return { success: true, data: cleanData };
  } catch (error) {
    console.error("Search Error:", error);
    return { success: false, data: [] };
  }
}

// 6. Force Download Image Logic
export async function getDownloadBlob(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image");
    
    const arrayBuffer = await response.arrayBuffer();
    // Convert the image to a Base64 string so it can be sent to the client
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    return { success: true, base64, contentType };
  } catch (error) {
    console.error("Download Error:", error);
    return { success: false };
  }
}