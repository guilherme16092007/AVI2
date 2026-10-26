import "@fastify/jwt";
import { Papel } from "../types";

export interface PayloadToken {
  sub: string;
  username: string;
  papel: Papel;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: PayloadToken;
    user: PayloadToken;
  }
}
