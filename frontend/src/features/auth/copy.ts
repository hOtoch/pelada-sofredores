/**
 * Piadas internas da pelada. A tela de login sorteia uma a cada visita, entao
 * ninguem cansa da mesma frase — e ninguem apanha sozinho toda semana.
 */
export const loginFootnotes = [
  "Aqui todo mundo vota como se tivesse visto a pelada inteira.",
  "Nota 5 é elogio, nota 1 é opinião. Chorar não sobe overall.",
  "O Julio ganhou todas as partidas de novo. Pergunta pra ele.",
  "Toda dividida no Eliezer foi falta. Segundo o Eliezer.",
  "PL e Baiano seguem firmes na disputa pela lanterna do overall.",
  "Ninguém aqui joga mal, todo mundo só foi mal avaliado.",
  "A votação abre no fim do jogo. A choradeira, dez minutos depois.",
];

export const pickLoginFootnote = () =>
  loginFootnotes[Math.floor(Math.random() * loginFootnotes.length)];
