import { confirmarPendente, lerPendentes, marcarErro } from './bd.js';

let envioEmCurso = false;

export async function enviarPendentes(sessao, {
  aoExpirar = () => {},
  aoSemLigacao = () => {},
  aoAtualizar = () => {}
} = {}) {
  if (envioEmCurso) return;
  envioEmCurso = true;

  try {
    const pendentes = await lerPendentes();
    for (const pendente of pendentes) {
      if (pendente.utilizador !== sessao.utilizador || pendente.erro !== null) continue;

      let resposta;
      try {
        resposta = await fetch('/v2/sugestoes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: pendente.titulo,
            descricao: pendente.descricao,
            categoria: pendente.categoria
          })
        });
      } catch {
        await aoSemLigacao();
        break;
      }

      if (resposta.status === 201) {
        const sugestao = await resposta.json();
        await confirmarPendente(pendente.idLocal, sugestao);
        continue;
      }
      if (resposta.status === 400) {
        const erro = await resposta.json();
        await marcarErro(pendente.idLocal, erro.mensagem);
        continue;
      }
      if (resposta.status === 401) {
        await aoExpirar(pendentes.length);
      }
      break;
    }
  } finally {
    envioEmCurso = false;
    await aoAtualizar();
  }
}
