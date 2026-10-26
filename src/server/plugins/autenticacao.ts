import type { FastifyRequest } from "fastify";
import { ErroNaoAutenticado } from "../erros";
import { Ator } from "../servicos/politicas";
import "../tipos-jwt";

export async function autenticar(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new ErroNaoAutenticado("Token ausente, invalido ou expirado. Autentique-se em POST /auth/login.");
  }
}

export function atorDe(request: FastifyRequest): Ator {
  const { sub, username, papel } = request.user;
  return { id: sub, username, papel };
}
