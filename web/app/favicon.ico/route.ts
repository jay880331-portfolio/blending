import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const icon = await readFile(path.join(process.cwd(), "public/favicon.webp"));

  return new Response(icon, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
