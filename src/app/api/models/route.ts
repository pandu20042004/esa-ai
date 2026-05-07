import { createEsaiRepository } from "@/lib/server/repositories/esai-repository";

export async function GET() {
  const repository = createEsaiRepository();
  return Response.json(await repository.listModels());
}

