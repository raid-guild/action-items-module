import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const document = await readFile(path.join(process.cwd(), "openapi", "action-items.openapi.yaml"), "utf8");
  return new Response(document, {
    headers: {
      "content-type": "application/yaml; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
