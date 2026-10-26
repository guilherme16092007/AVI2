import { carregarAmbiente } from "../../src/server/config/env";
import { ErroConflito, ErroNaoAutenticado, ErroNaoEncontrado, ErroPermissao, traduzirErro } from "../../src/server/erros";
import {
  conferirVersao,
  dataISO,
  hojeLocalISO,
  interpretarEstadoFisico,
  LIMITE_MAXIMO,
  normalizarPaginacao,
  paraData,
} from "../../src/server/servicos/util";
import { ErroDominio, ErroValidacao, EstadoFisico } from "../../src/types";

let total = 0;
let falhas = 0;
function afirmar(condicao: boolean, descricao: string): void {
  total += 1;
  if (condicao) console.log(`  \x1b[32mOK\x1b[0m     ${descricao}`);
  else {
    falhas += 1;
    console.log(`  \x1b[31mFALHOU\x1b[0m ${descricao}`);
  }
}
function lanca(fn: () => unknown, trecho?: string): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return trecho === undefined || (e instanceof Error && e.message.includes(trecho));
  }
}

const SEGREDO = "x".repeat(32);

console.log("\n=== Ambiente ===");
const ok = carregarAmbiente({ DATABASE_URL: "postgresql://u:p@h:5432/d", JWT_SECRET: SEGREDO });
afirmar(ok.PORT === 3000 && ok.HOST === "127.0.0.1" && ok.JWT_EXPIRES_IN === "30m" && ok.LOG_LEVEL === "info", "valores padrao: porta 3000, host 127.0.0.1, JWT 30m, log info");
afirmar(carregarAmbiente({ DATABASE_URL: "x", JWT_SECRET: SEGREDO, PORT: "8080" }).PORT === 8080, "PORT e configuravel por variavel de ambiente");
afirmar(lanca(() => carregarAmbiente({ JWT_SECRET: SEGREDO }), "DATABASE_URL"), "DATABASE_URL ausente -> falha na inicializacao");
afirmar(lanca(() => carregarAmbiente({ DATABASE_URL: "x" }), "JWT_SECRET"), "JWT_SECRET ausente -> falha na inicializacao");
afirmar(lanca(() => carregarAmbiente({ DATABASE_URL: "x", JWT_SECRET: "curto" }), "minimo 32"), "JWT_SECRET curto demais e rejeitado");
afirmar(lanca(() => carregarAmbiente({ DATABASE_URL: "x", JWT_SECRET: SEGREDO, PORT: "abc" }), "PORT"), "PORT nao numerica e rejeitada");
afirmar(lanca(() => carregarAmbiente({ DATABASE_URL: "x", JWT_SECRET: SEGREDO, PORT: "70000" }), "PORT"), "PORT fora de 1..65535 e rejeitada");
afirmar(lanca(() => carregarAmbiente({ DATABASE_URL: "x", JWT_SECRET: SEGREDO, LOG_LEVEL: "verboso" }), "LOG_LEVEL"), "LOG_LEVEL invalido e rejeitado");

console.log("\n=== Traducao de erros para HTTP ===");
afirmar(traduzirErro(new ErroNaoAutenticado()).statusCode === 401, "ErroNaoAutenticado -> 401");
afirmar(traduzirErro(new ErroPermissao()).statusCode === 403, "ErroPermissao -> 403");
afirmar(traduzirErro(new ErroNaoEncontrado()).statusCode === 404, "ErroNaoEncontrado -> 404");
afirmar(traduzirErro(new ErroConflito("x")).statusCode === 409, "ErroConflito -> 409");
const v = traduzirErro(new ErroValidacao("CNPJ invalido", ["cnpj"]));
afirmar(v.statusCode === 422 && v.erro === "VALIDACAO_NEGOCIO" && Array.isArray(v.detalhes), "ErroValidacao (AV1) -> 422 com os campos");
afirmar(traduzirErro(new ErroDominio("regra")).statusCode === 422, "ErroDominio (AV1) -> 422");
const ajv = traduzirErro(Object.assign(new Error("body must have required property 'cnpj'"), {
  validation: [{ instancePath: "", message: "must have required property 'cnpj'", params: { missingProperty: "cnpj" } }],
  validationContext: "body",
}));
afirmar(ajv.statusCode === 400 && ajv.erro === "REQUISICAO_INVALIDA", "falha de JSON Schema (Ajv) -> 400");
afirmar(Array.isArray(ajv.detalhes) && (ajv.detalhes as { campo?: string }[])[0].campo === "cnpj", "detalhes da validacao apontam o campo ausente");
const p2002 = traduzirErro(Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["cnpj"] } }));
afirmar(p2002.statusCode === 409 && p2002.mensagem.includes("cnpj"), "Prisma P2002 (UNIQUE) -> 409 citando o campo");
afirmar(traduzirErro(Object.assign(new Error("fk"), { code: "P2003" })).statusCode === 422, "Prisma P2003 (FK) -> 422");
afirmar(traduzirErro(Object.assign(new Error("nf"), { code: "P2025" })).statusCode === 404, "Prisma P2025 -> 404");
afirmar(traduzirErro(new Error('new row for relation "Movimentacao" violates check constraint "ck_x"')).statusCode === 422, "violacao de CHECK do banco -> 422");
afirmar(traduzirErro(Object.assign(new Error("Unexpected token"), { statusCode: 400 })).statusCode === 400, "erro 4xx do Fastify (JSON malformado) preserva o status");
const interno = traduzirErro(new Error("senha do banco: segredo123"));
afirmar(interno.statusCode === 500 && !interno.mensagem.includes("segredo123"), "erro inesperado -> 500 generico, sem vazar a mensagem interna");

console.log("\n=== Utilitarios ===");
afirmar(dataISO(paraData("2026-10-22")) === "2026-10-22", "paraData/dataISO fazem ida e volta");
afirmar(lanca(() => paraData("22/10/2026")), "data fora do formato AAAA-MM-DD e rejeitada");
afirmar(lanca(() => paraData("2026-02-30")), "30 de fevereiro e rejeitado");
afirmar(/^\d{4}-\d{2}-\d{2}$/.test(hojeLocalISO()), "hojeLocalISO no formato AAAA-MM-DD");
afirmar(interpretarEstadoFisico(" bom ") === EstadoFisico.BOM, "interpretarEstadoFisico aceita caixa/espacos");
afirmar(lanca(() => interpretarEstadoFisico("PESSIMO"), "Valores aceitos"), "estado fisico invalido lista os valores aceitos");
afirmar(normalizarPaginacao().limite === 50 && normalizarPaginacao().offset === 0, "paginacao padrao: limite 50, offset 0");
afirmar(normalizarPaginacao({ limite: 10_000 }).limite === LIMITE_MAXIMO, "limite maximo de paginacao e imposto");
afirmar(normalizarPaginacao({ limite: -5, offset: -9 }).limite === 1 && normalizarPaginacao({ offset: -9 }).offset === 0, "valores negativos sao saneados");
afirmar(!lanca(() => conferirVersao(3, undefined, "X")) && !lanca(() => conferirVersao(3, 3, "X")), "versao omitida ou igual a atual passa");
afirmar(lanca(() => conferirVersao(3, 2, "Equipamento"), "Conflito de versao"), "versao divergente -> conflito");

console.log("\n" + "=".repeat(64));
console.log(`RESULTADO: ${total - falhas}/${total} verificacoes passaram.`);
console.log("=".repeat(64));
if (falhas > 0) process.exit(1);
