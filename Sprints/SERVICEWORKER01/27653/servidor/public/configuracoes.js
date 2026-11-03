const POR_OMISSAO = { tema: 'claro', ordenacao: 'recentes' };

export function lerConfiguracoes() {
  try {
    const valor = localStorage.getItem('configuracoes');
    if (valor === null) return { ...POR_OMISSAO };

    const dados = JSON.parse(valor);
    if (!dados || !['claro', 'escuro'].includes(dados.tema) ||
        !['recentes', 'estado'].includes(dados.ordenacao)) {
      return { ...POR_OMISSAO };
    }
    return { tema: dados.tema, ordenacao: dados.ordenacao };
  } catch {
    return { ...POR_OMISSAO };
  }
}

export function guardarConfiguracoes(configuracoes) {
  localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
}

export function aplicarConfiguracoes(configuracoes) {
  document.documentElement.dataset.tema = configuracoes.tema;
}
