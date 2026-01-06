function isHeicLike(file: File) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return (
    t === "image/heic" ||
    t === "image/heif" ||
    t === "image/heic-sequence" ||
    t === "image/heif-sequence" ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  );
}

export async function normalizeToRenderableFile(file: File): Promise<Blob> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (!isHeic) return file;

  const mod = await import("heic2any");
  const heic2any = mod.default;

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  return Array.isArray(converted) ? converted[0] : converted;
}


// export async function normalizeToRenderableFile(file: File): Promise<Blob> {
//   // 1) まず「ブラウザが素で読めるか」を最優先で試す（Safari系/一部環境でHEICも通る）
//   try {
//     await createImageBitmap(file);
//     return file;
//   } catch {
//     // 続行
//   }

//   // 2) HEICならブラウザ内変換（heic2any）
//   if (isHeicLike(file)) {
//     try {
//       const mod = await import("heic2any");
//       const heic2any = mod.default;

//       const converted = await heic2any({
//         blob: file,
//         toType: "image/jpeg",
//         quality: 0.92,
//       });

//       const blob = Array.isArray(converted) ? converted[0] : converted;

//       // 変換後が本当に読めるか最終チェック
//       await createImageBitmap(blob);
//       return blob;
//     } catch (e) {
//       // heic2any が対応してないHEICだった → サーバ変換へフォールバック
//       console.warn("heic2any failed, fallback to /api/convert:", e);
//     }
//   }

//   // 3) 最後にサーバ変換（sharpなど）
//   const fd = new FormData();
//   fd.append("file", file);

//   const res = await fetch("/api/convert", { method: "POST", body: fd });
//   if (!res.ok) {
//     const txt = await res.text().catch(() => "");
//     throw new Error(`convert failed: ${res.status} ${txt}`);
//   }

//   const out = await res.blob();
//   // ここも読めるかチェック（失敗なら「このHEICはサポート外」と明確に出せる）
//   try {
//     await createImageBitmap(out);
//   } catch {
//     throw new Error("この画像は変換後もブラウザで開けません（HEICの形式が非対応の可能性）");
//   }
//   return out;
// }
