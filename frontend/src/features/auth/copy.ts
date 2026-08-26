/**
 * Piadas internas da pelada. A tela de login sorteia uma a cada visita, entao
 * ninguem cansa da mesma frase — e ninguem apanha sozinho toda semana.
 */
export const loginFootnotes = [
  "Aqui todo mundo vota como se tivesse visto a pelada inteira.",
  "Nota 5 é elogio, nota 2 é opinião. Chorar não sobe overall.",
  "O Julio ganhou todas as partidas de novo. Pergunta pra ele.",
  "PAROU PAROU PAROU, falta no Eliezer.",
  "Quem é pior, PL ou Baiano?",
  "Ninguém aqui joga mal, todo mundo só foi mal avaliado.",
  "A votação abre no fim do jogo. A choradeira, dez minutos depois.",
];

export const pickLoginFootnote = () =>
  loginFootnotes[Math.floor(Math.random() * loginFootnotes.length)];
