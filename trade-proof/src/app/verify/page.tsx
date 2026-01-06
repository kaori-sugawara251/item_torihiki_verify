"use client";

import { useRef, useState } from "react";
import jsQR from "jsqr";
import { verifyToken } from "@/lib/crypto";
import { normalizeToRenderableFile } from "@/lib/heic";

export default function VerifyPage() {
  const [result, setResult] = useState<string>("");
  const [payload, setPayload] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function onVerify() {
    setResult("");
    setPayload("");
  
    const file = fileRef.current?.files?.[0];
    if (!file) return setResult("画像を選んでください");
  
    const normalizedFile = await normalizeToRenderableFile(file);
  
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(normalizedFile);
    });
  
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  
    // ---- ここからが重要：全体を縮小して jsQR に渡す ----
    const maxSide = 1400; // 1000〜1600あたりが現実的
    const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  
    const scan = document.createElement("canvas");
    scan.width = Math.max(1, Math.floor(canvas.width * scale));
    scan.height = Math.max(1, Math.floor(canvas.height * scale));
  
    const sctx = scan.getContext("2d")!;
    // 縮小は smoothing ON の方が jsQR は安定することが多い
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(canvas, 0, 0, scan.width, scan.height);
  
    const imageData = sctx.getImageData(0, 0, scan.width, scan.height);
  
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
  
    if (!code?.data) {
      return setResult("QRが読み取れませんでした（圧縮/切り抜き/位置ズレの可能性）");
    }
  
    const pk = process.env.NEXT_PUBLIC_PUBLIC_KEY_BASE64 ?? "";
    if (!pk) return setResult("公開鍵が設定されていません");
  
    const v = await verifyToken(code.data, pk);
    if (!v.ok) return setResult(`NG: ${v.error}`);
  
    setResult("OK: 署名検証に成功しました");
    setPayload(v.payloadJson);
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>検証</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" />
        <button onClick={onVerify}>検証</button>

        <div>{result}</div>
        {payload && (
          <>
            <h3>Payload</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{payload}</pre>
          </>
        )}

        <canvas ref={canvasRef} style={{ width: "100%", border: "1px solid #333", marginTop: 12 }} />
      </div>
    </main>
  );
}
