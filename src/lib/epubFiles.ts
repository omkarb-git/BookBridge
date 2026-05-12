import { collection, doc, getDocs, orderBy, query, setDoc, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const CHUNK_SIZE = 96 * 1024;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;

  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, i + step);
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function uploadEpubToFirestoreChunks(
  db: Firestore,
  epubId: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const totalChunks = Math.max(1, Math.ceil(buffer.length / CHUNK_SIZE));
  let processed = 0;

  for (let batchStart = 0; batchStart < totalChunks; batchStart += 200) {
    const batch = writeBatch(db);
    const batchEnd = Math.min(totalChunks, batchStart + 200);

    for (let index = batchStart; index < batchEnd; index += 1) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(buffer.length, start + CHUNK_SIZE);
      const data = uint8ToBase64(buffer.subarray(start, end));
      const chunkRef = doc(collection(db, 'epubs', epubId, 'chunks'));

      batch.set(chunkRef, {
        index,
        data,
        createdAt: Date.now(),
      });

      processed += 1;
      onProgress?.(Math.min(95, 20 + Math.round((processed / totalChunks) * 70)));
    }

    await batch.commit();
  }

  return {
    chunkCount: totalChunks,
    byteSize: buffer.length,
    mimeType: file.type || 'application/epub+zip',
  };
}

export async function downloadEpubFromFirestoreChunks(
  db: Firestore,
  epubId: string,
  fileName: string,
  mimeType = 'application/epub+zip'
) {
  const chunksSnap = await getDocs(query(collection(db, 'epubs', epubId, 'chunks'), orderBy('index', 'asc')));
  const parts = chunksSnap.docs.map((entry) => {
    const data = entry.data() as { data?: string };
    return base64ToUint8(data.data || '');
  });

  const blob = new Blob(parts, { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName.toLowerCase().endsWith('.epub') ? fileName : `${fileName}.epub`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
export async function getEpubBlobUrlFromFirestore(
  db: Firestore,
  epubId: string,
  mimeType = 'application/epub+zip'
): Promise<string> {
  const chunksSnap = await getDocs(query(collection(db, 'epubs', epubId, 'chunks'), orderBy('index', 'asc')));
  if (chunksSnap.empty) throw new Error("No book data found.");
  
  const parts = chunksSnap.docs.map((entry) => {
    const data = entry.data() as { data?: string };
    return base64ToUint8(data.data || '');
  });

  const blob = new Blob(parts, { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function deleteEpubFromFirestoreChunks(
  db: Firestore,
  epubId: string
) {
  const chunksSnap = await getDocs(collection(db, 'epubs', epubId, 'chunks'));
  const batch = writeBatch(db);
  
  chunksSnap.docs.forEach((chunk) => {
    batch.delete(chunk.ref);
  });
  
  await batch.commit();
}
