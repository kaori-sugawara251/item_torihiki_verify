"use client";

import { useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { normalizeToRenderableFile } from "@/lib/heic";

function isoNowJstDate() {
  // MVPなのでざっくり日付文字列
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function randomNonce() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map((n) => n.toString(16).padStart(2, "0")).join("");
}

export default function Page() {
  const [handle, setHandle] = useState("@");
  const [challenge, setChallenge] = useState("");
  const [expiresMinutes, setExpiresMinutes] = useState(60);
  const [status, setStatus] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const issuedAt = useMemo(() => isoNowJstDate(), []);
  const nonce = useMemo(() => randomNonce(), []);

  async function onGenerate() {
    setStatus("");
    setDownloadUrl("");

    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus("画像を選んでください");
    if (!challenge) return setStatus("合言葉（challenge）を入れてください");

    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

    // 署名トークン発行
    const res = await fetch("/api/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        handle,
        challenge,
        issuedAt,
        expiresAt,
        nonce,
      }),
    });

    if (!res.ok) return setStatus("署名発行に失敗しました");
    const { token } = await res.json();
    console.log("token length =", token.length);

    // 画像読み込み
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

    // 透かし（全面タイル）
    // const wm = `${handle} ${challenge} ${issuedAt} ${nonce}`;
    const wm = ` ${handle} ${challenge} ${issuedAt} `;
    const angle = (-20 * Math.PI) / 180;
    const fontSize = Math.max(12, Math.floor(canvas.width / 60));

    // タイル用キャンバスを作る
    const tile = document.createElement("canvas");
    const tctx = tile.getContext("2d")!;

    // ★先にfontを設定してから測る
    tctx.font = `${fontSize}px sans-serif`;
    const m = tctx.measureText(wm);
    const left = m.actualBoundingBoxLeft ?? 0;
    const right = m.actualBoundingBoxRight ?? m.width;
    const tightW = left + right;

    // ★タイル幅：文字幅 + 余白 + 安全分
    const tileW = Math.ceil(tightW + 10);

    // ★縦は“線感”を出したいので小さめ（1行運用）
    const tileH = Math.ceil(fontSize * 7);

    tile.width = tileW;
    tile.height = tileH;

    // タイルに1回だけ描く（中央基準）
    tctx.clearRect(0, 0, tile.width, tile.height);
    tctx.font = `${fontSize}px sans-serif`;
    tctx.globalAlpha = 0.4;          // ←ここだけで透過を管理（fillStyleは不透明でOK）
    tctx.fillStyle = "#000";
    tctx.textAlign = "left";
    tctx.textBaseline = "middle";

    const x = Math.ceil(left);      // 左端からこの位置に描き始める
    const y = tileH / 2;
    tctx.fillText(wm, x, y);

    // 元キャンバスに敷き詰め
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);

    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      // 回転すると端が欠けるので大きめに塗る
      ctx.fillRect(-canvas.width * 2, -canvas.height * 2, canvas.width * 4, canvas.height * 4);
    } else {
      // 念のためフォールバック
      for (let y = -canvas.height * 2; y < canvas.height * 2; y += tileH) {
        for (let x = -canvas.width * 2; x < canvas.width * 2; x += tileW) {
          ctx.drawImage(tile, x, y);
        }
      }
    }
    ctx.restore();

    // QR生成（右下固定）
    const min = Math.min(canvas.width, canvas.height);
    const qrSize = Math.max(160, Math.floor(min * 0.10));
    const pad = Math.floor(qrSize * 0.01);
    const box = qrSize + pad * 2;
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, token, {
      errorCorrectionLevel: "Q", // ★M→H
      margin: 2,                 // ★1→4（quiet zone）
      width: qrSize,             // ★ここ重要：最終サイズ
    });

    // ★ぼやけ防止
    ctx.imageSmoothingEnabled = false;

    // 背景は半透明より「不透明白」の方が読み取りに強い
    const boxX = canvas.width - box;
    const boxY = canvas.height - box;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(boxX, boxY, box, box);

    // ★そのまま等倍で貼る（拡大縮小なし）
    ctx.drawImage(qrCanvas, boxX + pad, boxY + pad);

    // DL
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("生成しました");
    }, "image/png");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>取引画像ジェネレータ</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" />
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@your_handle" />
        <input value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder="合言葉（challenge）" />
        <input
          type="number"
          value={expiresMinutes}
          onChange={(e) => setExpiresMinutes(Number(e.target.value))}
          min={5}
          max={24 * 60}
        />
        <button onClick={onGenerate}>生成</button>
        <div>{status}</div>

        {downloadUrl && (
          <a href={downloadUrl} download={`trade-proof-${issuedAt}.png`}>
            画像をダウンロード
          </a>
        )}

        <canvas ref={canvasRef} style={{ width: "100%", border: "1px solid #333", marginTop: 12 }} />
      </div>
    </main>
  );
}
