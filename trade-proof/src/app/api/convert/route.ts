import sharp from "sharp";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("file is required", { status: 400 });

  const input = Buffer.from(await file.arrayBuffer());

  try {
    // ここで読めるかチェック（落ちるならsharpがHEICをdecodeできてない）
    const meta = await sharp(input).metadata();
    // デバッグ：必要なら一時的に返す
    // return Response.json(meta);

    const out = await sharp(input).rotate().jpeg({ quality: 90 }).toBuffer();

    return new Response(Buffer.from(out), {
      headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(
      `convert failed: ${error.message}`,
      { status: 500 }
    );
  }
}
