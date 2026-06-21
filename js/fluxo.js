// ============================================
// FLUXO DO LAUDO — Controle de etapas
// ============================================

let laudoAtual = null;
let etapasAtivas = [];
let etapaAtualIndex = 0;
let amostras = [];
let autoSaveTimer = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await inicializarLaudo();
  configurarAutoSave();
  configurarEventos();
});

async function inicializarLaudo() {
  // Busca referência e finalidade do sessionStorage
  let referencia = sessionStorage.getItem('laudo_referencia');
  let finalidade = sessionStorage.getItem('laudo_finalidade');
  
  // Se não houver, pode ser um rascunho sendo retomado
  const retomarRef = sessionStorage.getItem('laudo_retomar');
  if (retomarRef) {
    laudoAtual = await buscarLaudo(retomarRef);
    if (laudoAtual) {
      referencia = laudoAtual.referencia;
      finalidade = laudoAtual.finalidade;
      sessionStorage.removeItem('laudo_retomar');
    }
  }
  
  if (!referencia) {
    alert('Nenhuma avaliação em andamento. Voltando ao início.');
    window.location.href = 'index.html';
    return;
  }
  
  // Cria ou carrega o laudo
  if (!laudoAtual) {
    laudoAtual = {
      referencia,
      finalidade,
      status: 'rascunho',
      data_criacao: new Date().toISOString(),
      corretor: {},
      solicitante: {},
      proprietario: {},
      imovel: {},
      cap_rate: { modo: 'amostras', amostras: [], manual: {} },
      locacao: {},
      venda: {},
      fundamentacao: ''
    };
    await salvarLaudo(laudoAtual);
  }
  
  // Define etapas ativas conforme finalidade
  definirEtapasAtivas(finalidade);
  
  // Preenche formulário com dados existentes
  preencherFormulario();
  
  // Atualiza UI
  document.getElementById('topo-referencia').textContent = referencia;
  atualizarIndicadoresEtapas();
  mostrarEtapa(0);
}

function definirEtapasAtivas(finalidade) {
  // Etapa 1 (dados) sempre ativa
  // Etapa 5 (revisão) sempre ativa
  etapasAtivas = [1];
  
  if (['apenas_cap_rate', 'apenas_venda', 'venda_locacao'].includes(finalidade)) {
    etapasAtivas.push(2); // Cap rate
  }
  if (['apenas_locacao', 'venda_locacao'].includes(finalidade)) {
    etapasAtivas.push(3); // Locação
  }
  if (['apenas_venda', 'venda_locacao'].includes(finalidade)) {
    etapasAtivas.push(4); // Venda
  }
  
  etapasAtivas.push(5); // Revisão
}

function atualizarIndicadoresEtapas() {
  const container = document.getElementById('etapas-indicadores');
  container.innerHTML = etapasAtivas.map((num, i) => `
    <div class="etapa-indicador ${i === etapaAtualIndex ? 'ativa' : ''} ${i < etapaAtualIndex ? 'concluida' : ''}">
      ${num === 5 ? '✓' : num}
    </div>
  `).join('');
}

function mostrarEtapa(index) {
  etapaAtualIndex = index;
  const numEtapa = etapasAtivas[index];
  
  // Esconde todas
  document.querySelectorAll('.etapa').forEach(e => e.style.display = 'none');
  // Mostra a atual
  document.getElementById(`etapa-${numEtapa}`).style.display = 'block';
  
  // Atualiza indicadores
  atualizarIndicadoresEtapas();
  
  // Atualiza barra de progresso
  const progresso = ((index + 1) / etapasAtivas.length) * 100;
  document.getElementById('progresso-preenchimento').style.width = `${progresso}%`;
  
  // Atualiza botões
  document.getElementById('btn-voltar').style.visibility = index === 0 ? 'hidden' : 'visible';
  document.getElementById('btn-continuar').textContent = 
    index === etapasAtivas.length - 1 ? 'Revisar' : 'Continuar →';
  
  // Ações específicas por etapa
  if (numEtapa === 2) atualizarEstatisticaAmostras();
  if (numEtapa === 4) prePreencherVenda();
  if (numEtapa === 5) gerarResumoRevisao();
  
  // Rola para o topo
  window.scrollTo(0, 0);
}

// ============================================
// NAVEGAÇÃO
// ============================================

function proximaEtapa() {
  // Valida etapa atual antes de avançar
  if (!validarEtapaAtual()) return;
  
  // Salva dados da etapa atual
  coletarDadosEtapaAtual();
  
  if (etapaAtualIndex < etapasAtivas.length - 1) {
    mostrarEtapa(etapaAtualIndex + 1);
    salvarRascunhoRapido();
  } else {
    // Última etapa — já está na revisão
    document.getElementById('etapa-5').scrollIntoView({ behavior: 'smooth' });
  }
}

function etapaAnterior() {
  if (etapaAtualIndex > 0) {
    coletarDadosEtapaAtual();
    mostrarEtapa(etapaAtualIndex - 1);
  }
}

function validarEtapaAtual() {
  const numEtapa = etapasAtivas[etapaAtualIndex];
  
  if (numEtapa === 1) {
    const finalidade = document.querySelector('input[name="finalidade"]:checked');
    if (!finalidade) {
      alert('Selecione a finalidade da avaliação.');
      return false;
    }
    // Se mudou a finalidade, redefine as etapas
    if (laudoAtual.finalidade !== finalidade.value) {
      laudoAtual.finalidade = finalidade.value;
      definirEtapasAtivas(finalidade.value);
    }
  }
  
  return true;
}

function coletarDadosEtapaAtual() {
  const numEtapa = etapasAtivas[etapaAtualIndex];
  
  if (numEtapa === 1) {
    laudoAtual.corretor = {
      nome: val('corretor_nome'),
      creci: val('corretor_creci'),
      data: val('corretor_data'),
      contato: val('corretor_contato')
    };
    laudoAtual.solicitante = {
      nome: val('solicitante_nome'),
      doc: val('solicitante_doc')
    };
    laudoAtual.proprietario = {
      nome: val('proprietario_nome'),
      doc: val('proprietario_doc')
    };
    laudoAtual.imovel = {
      endereco: val('imovel_endereco'),
      cidade: val('imovel_cidade'),
      bairro: val('imovel_bairro'),
      tipo: val('imovel_tipo'),
      matricula: val('imovel_matricula'),
      area_construida: num('imovel_area_construida'),
      area_terreno: num('imovel_area_terreno'),
      area_util: num('imovel_area_util'),
      dormitorios: num('imovel_dormitorios'),
      vagas: num('imovel_vagas'),
      ano: num('imovel_ano'),
      padrao: val('imovel_padrao'),
      conservacao: val('imovel_conservacao'),
      observacoes: val('imovel_observacoes')
    };
    laudoAtual.finalidade = document.querySelector('input[name="finalidade"]:checked')?.value;
  }
  
  if (numEtapa === 2) {
    const modo = document.querySelector('.aba.ativa').dataset.aba;
    laudoAtual.cap_rate.modo = modo;
    if (modo === 'amostras') {
      laudoAtual.cap_rate.amostras = amostras;
      const stats = calcularEstatistica(amostras.map(a => a.cap_rate_anual).filter(v => v > 0));
      laudoAtual.cap_rate.anual = stats.media;
      laudoAtual.cap_rate.mensal = stats.media ? stats.media / 12 : null;
      laudoAtual.cap_rate.fonte = 'amostras';
      laudoAtual.cap_rate.n_amostras = amostras.length;
    } else {
      laudoAtual.cap_rate.anual = num('cap_manual_anual');
      laudoAtual.cap_rate.mensal = laudoAtual.cap_rate.anual / 12;
      laudoAtual.cap_rate.fonte = val('cap_manual_fonte') || 'manual';
    }
  }
  
  if (numEtapa === 3) {
    const mobilia = document.querySelector('input[name="loc_mobilia"]:checked')?.value || 'vazio';
    laudoAtual.locacao = {
      aluguel_base: num('loc_aluguel_base'),
      mobilia,
      ajuste_mobilia: num('loc_ajuste_mobilia'),
      vacancia: num('loc_vacancia'),
      admin: num('loc_admin'),
      iptu: num('loc_iptu'),
      arb_menos: num('loc_arb_menos'),
      arb_mais: num('loc_arb_mais')
    };
    // Calcula e armazena os resultados
    const res = calcularLocacao(laudoAtual.locacao);
    Object.assign(laudoAtual.locacao, res);
  }
  
  if (numEtapa === 4) {
    laudoAtual.venda = {
      aluguel: num('venda_aluguel'),
      cap_rate: num('venda_cap_rate'),
      aj_edificacoes: num('venda_aj_edificacoes'),
      aj_inhabitavel: num('venda_aj_inhabitavel'),
      aj_reforma: num('venda_aj_reforma'),
      aj_benfeitorias: num('venda_aj_benfeitorias'),
      aj_oferta: num('venda_aj_oferta'),
      valor_adotado: num('venda_valor_adotado'),
      arb_menos: num('venda_arb_menos'),
      arb_mais: num('venda_arb_mais')
    };
    const res = calcularVenda(laudoAtual.venda);
    Object.assign(laudoAtual.venda, res);
  }
  
  if (numEtapa === 5) {
    laudoAtual.fundamentacao = val('fundamentacao');
  }
}

function preencherFormulario() {
  if (!laudoAtual) return;
  
  // Etapa 1
  if (laudoAtual.corretor) {
    setVal('corretor_nome', laudoAtual.corretor.nome);
    setVal('corretor_creci', laudoAtual.corretor.creci);
    setVal('corretor_data', laudoAtual.corretor.data);
    setVal('corretor_contato', laudoAtual.corretor.contato);
  }
  if (laudoAtual.solicitante) {
    setVal('solicitante_nome', laudoAtual.solicitante.nome);
    setVal('solicitante_doc', laudoAtual.solicitante.doc);
  }
  if (laudoAtual.proprietario) {
    setVal('proprietario_nome', laudoAtual.proprietario.nome);
    setVal('proprietario_doc', laudoAtual.proprietario.doc);
  }
  if (laudoAtual.imovel) {
    setVal('imovel_endereco', laudoAtual.imovel.endereco);
    setVal('imovel_cidade', laudoAtual.imovel.cidade);
    setVal('imovel_bairro', laudoAtual.imovel.bairro);
    setVal('imovel_tipo', laudoAtual.imovel.tipo);
    setVal('imovel_matricula', laudoAtual.imovel.matricula);
    setVal('imovel_area_construida', laudoAtual.imovel.area_construida);
    setVal('imovel_area_terreno', laudoAtual.imovel.area_terreno);
    setVal('imovel_area_util', laudoAtual.imovel.area_util);
    setVal('imovel_dormitorios', laudoAtual.imovel.dormitorios);
    setVal('imovel_vagas', laudoAtual.imovel.vagas);
    setVal('imovel_ano', laudoAtual.imovel.ano);
    setVal('imovel_padrao', laudoAtual.imovel.padrao);
    setVal('imovel_conservacao', laudoAtual.imovel.conservacao);
    setVal('imovel_observacoes', laudoAtual.imovel.observacoes);
  }
  if (laudoAtual.finalidade) {
    const radio = document.querySelector(`input[name="finalidade"][value="${laudoAtual.finalidade}"]`);
    if (radio) radio.checked = true;
  }
  
  // Etapa 2
  if (laudoAtual.cap_rate) {
    if (laudoAtual.cap_rate.modo === 'manual') {
      trocarAba('manual');
      setVal('cap_manual_anual', laudoAtual.cap_rate.anual);
      setVal('cap_manual_fonte', laudoAtual.cap_rate.fonte);
    } else {
      trocarAba('amostras');
      amostras = laudoAtual.cap_rate.amostras || [];
      renderizarAmostras();
    }
  }
  
  // Etapa 3
  if (laudoAtual.locacao) {
    setVal('loc_aluguel_base', laudoAtual.locacao.aluguel_base);
    if (laudoAtual.locacao.mobilia) {
      const r = document.querySelector(`input[name="loc_mobilia"][value="${laudoAtual.locacao.mobilia}"]`);
      if (r) r.checked = true;
    }
    setVal('loc_ajuste_mobilia', laudoAtual.locacao.ajuste_mobilia);
    setVal('loc_vacancia', laudoAtual.locacao.vacancia);
    setVal('loc_admin', laudoAtual.locacao.admin);
    setVal('loc_iptu', laudoAtual.locacao.iptu);
    setVal('loc_arb_menos', laudoAtual.locacao.arb_menos);
    setVal('loc_arb_mais', laudoAtual.locacao.arb_mais);
    calcularLocacaoUI();
  }
  
  // Etapa 4
  if (laudoAtual.venda) {
    setVal('venda_aluguel', laudoAtual.venda.aluguel);
    setVal('venda_cap_rate', laudoAtual.venda.cap_rate);
    setVal('venda_aj_edificacoes', laudoAtual.venda.aj_edificacoes);
    setVal('venda_aj_inhabitavel', laudoAtual.venda.aj_inhabitavel);
    setVal('venda_aj_reforma', laudoAtual.venda.aj_reforma);
    setVal('venda_aj_benfeitorias', laudoAtual.venda.aj_benfeitorias);
    setVal('venda_aj_oferta', laudoAtual.venda.aj_oferta);
    setVal('venda_valor_adotado', laudoAtual.venda.valor_adotado);
    setVal('venda_arb_menos', laudoAtual.venda.arb_menos);
    setVal('venda_arb_mais', laudoAtual.venda.arb_mais);
    calcularVendaUI();
  }
  
  // Etapa 5
  setVal('fundamentacao', laudoAtual.fundamentacao);
}

// ============================================
// AMOSTRAS (Etapa 2)
// ============================================

function adicionarAmostra() {
  amostras.push({
    id: Date.now(),
    endereco: '',
    tipo_evidencia: 'oferta',
    valor_venda: 0,
    aluguel_mensal: 0,
    area_m2: 0,
    fonte: '',
    observacoes: ''
  });
  renderizarAmostras();
}

function removerAmostra(id) {
  amostras = amostras.filter(a => a.id !== id);
  renderizarAmostras();
  atualizarEstatisticaAmostras();
}

function atualizarAmostra(id, campo, valor) {
  const a = amostras.find(x => x.id === id);
  if (!a) return;
  a[campo] = ['valor_venda', 'aluguel_mensal', 'area_m2'].includes(campo) ? parseFloat(valor) || 0 : valor;
  
  // Recalcula cap rate da amostra
  if (a.valor_venda > 0 && a.aluguel_mensal > 0) {
    a.cap_rate_anual = ((a.aluguel_mensal * 12) / a.valor_venda) * 100;
  } else {
    a.cap_rate_anual = 0;
  }
  
  atualizarEstatisticaAmostras();
}

function renderizarAmostras() {
  const container = document.getElementById('lista-amostras');
  if (amostras.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma amostra adicionada.</p>';
    return;
  }
  
  container.innerHTML = amostras.map((a, i) => `
    <div class="amostra-card">
      <div class="amostra-cabecalho">
        <strong>Amostra ${i + 1}</strong>
        <button class="btn-remover" onclick="removerAmostra(${a.id})">×</button>
      </div>
      <label class="campo">
        <span>Endereço / identificação</span>
        <input type="text" class="campo-input" value="${a.endereco || ''}" 
               oninput="atualizarAmostra(${a.id}, 'endereco', this.value)">
      </label>
      <label class="campo">
        <span>Tipo de evidência</span>
        <select class="campo-select" onchange="atualizarAmostra(${a.id}, 'tipo_evidencia', this.value)">
          <option value="venda_efetiva" ${a.tipo_evidencia === 'venda_efetiva' ? 'selected' : ''}>Venda efetiva (peso 100%)</option>
          <option value="oferta" ${a.tipo_evidencia === 'oferta' ? 'selected' : ''}>Oferta anunciada (peso 80%)</option>
          <option value="opiniao" ${a.tipo_evidencia === 'opiniao' ? 'selected' : ''}>Opinião de mercado (peso 60%)</option>
        </select>
      </label>
      <div class="campo-linha">
        <label class="campo campo-medio">
          <span>Valor venda/anúncio (R$)</span>
          <input type="number" class="campo-input" inputmode="decimal" step="0.01" 
                 value="${a.valor_venda || ''}" oninput="atualizarAmostra(${a.id}, 'valor_venda', this.value)">
        </label>
        <label class="campo campo-medio">
          <span>Aluguel mensal (R$)</span>
          <input type="number" class="campo-input" inputmode="decimal" step="0.01" 
                 value="${a.aluguel_mensal || ''}" oninput="atualizarAmostra(${a.id}, 'aluguel_mensal', this.value)">
        </label>
      </div>
      <div class="amostra-resultado">
        Cap rate calculado: <strong>${a.cap_rate_anual ? a.cap_rate_anual.toFixed(2) + '% a.a.' : '—'}</strong>
      </div>
    </div>
  `).join('');
  
  atualizarEstatisticaAmostras();
}

function atualizarEstatisticaAmostras() {
  const rates = amostras.map(a => a.cap_rate_anual).filter(v => v > 0);
  const box = document.getElementById('estatistica-amostras');
  
  if (rates.length === 0) {
    box.style.display = 'none';
    setText('res-cap-mensal', '—');
    setText('res-cap-anual', '—');
    setText('res-amostras-n', '0');
    return;
  }
  
  box.style.display = 'block';
  const stats = calcularEstatistica(rates);
  
  setText('stat-media', stats.media.toFixed(2) + '%');
  setText('stat-mediana', stats.mediana.toFixed(2) + '%');
  setText('stat-dp', stats.dp.toFixed(2) + '%');
  setText('stat-cv', (stats.cv * 100).toFixed(1) + '%');
  
  document.getElementById('alerta-cv').style.display = stats.cv > 0.3 ? 'block' : 'none';
  document.getElementById('alerta-amostras').style.display = rates.length < 3 ? 'block' : 'none';
  
  setText('res-cap-mensal', (stats.media / 12).toFixed(3) + '%');
  setText('res-cap-anual', stats.media.toFixed(2) + '%');
  setText('res-amostras-n', rates.length.toString());
}

// ============================================
// ABAS (Etapa 2)
// ============================================

function trocarAba(aba) {
  document.querySelectorAll('.aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  document.getElementById('aba-amostras').style.display = aba === 'amostras' ? 'block' : 'none';
  document.getElementById('aba-manual').style.display = aba === 'manual' ? 'block' : 'none';
}

// ============================================
// EVENTOS DE CÁLCULO EM TEMPO REAL
// ============================================

function configurarEventos() {
  // Locação
  ['loc_aluguel_base', 'loc_ajuste_mobilia', 'loc_vacancia', 'loc_admin', 'loc_iptu', 
   'loc_arb_menos', 'loc_arb_mais'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcularLocacaoUI);
  });
  document.querySelectorAll('input[name="loc_mobilia"]').forEach(r => {
    r.addEventListener('change', () => {
      const valores = { vazio: 0, semimobiliado: 7, mobiliado: 15 };
      document.getElementById('loc_ajuste_mobilia').value = valores[r.value] || 0;
      calcularLocacaoUI();
    });
  });
  
  // Venda
  ['venda_aluguel', 'venda_cap_rate', 'venda_aj_edificacoes', 'venda_aj_inhabitavel',
   'venda_aj_reforma', 'venda_aj_benfeitorias', 'venda_aj_oferta', 'venda_valor_adotado',
   'venda_arb_menos', 'venda_arb_mais'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcularVendaUI);
  });
  
  // Cap rate manual
  const capManual = document.getElementById('cap_manual_anual');
  if (capManual) {
    capManual.addEventListener('input', () => {
      const anual = parseFloat(capManual.value) || 0;
      setText('res-cap-manual-mensal', (anual / 12).toFixed(3) + '%');
    });
  }
  
  // Aceite do termo
  const aceite = document.getElementById('aceite_termo');
  if (aceite) {
    aceite.addEventListener('change', () => {
      document.getElementById('btn-finalizar').disabled = !aceite.checked;
    });
  }
}

function prePreencherVenda() {
  // Preenche aluguel com o líquido da locação (se existir)
  if (laudoAtual.locacao?.aluguel_liquido && !val('venda_aluguel')) {
    setVal('venda_aluguel', laudoAtual.locacao.aluguel_liquido.toFixed(2));
  }
  // Preenche cap rate com o apurado
  if (laudoAtual.cap_rate?.anual && !val('venda_cap_rate')) {
    setVal('venda_cap_rate', laudoAtual.cap_rate.anual.toFixed(2));
  }
  calcularVendaUI();
}

// ============================================
// SALVAMENTO
// ============================================

function configurarAutoSave() {
  autoSaveTimer = setInterval(() => {
    coletarDadosEtapaAtual();
    salvarLaudo(laudoAtual).catch(err => console.error('Auto-save falhou:', err));
  }, 30000); // 30 segundos
}

async function salvarRascunhoRapido() {
  coletarDadosEtapaAtual();
  try {
    await salvarLaudo(laudoAtual);
    mostrarToast('Rascunho salvo');
  } catch (err) {
    console.error('Erro ao salvar:', err);
  }
}

async function salvarRascunho() {
  await salvarRascunhoRapido();
  window.location.href = 'laudos.html';
}

async function finalizarParecer() {
  coletarDadosEtapaAtual();
  if (!document.getElementById('aceite_termo').checked) {
    alert('Você precisa aceitar o termo de responsabilidade.');
    return;
  }
  
  try {
    await finalizarLaudo(laudoAtual.referencia);
    mostrarToast('✅ Parecer finalizado e adicionado ao banco de amostras');
    setTimeout(() => {
      window.location.href = 'laudos.html';
    }, 1500);
  } catch (err) {
    alert('Erro ao finalizar: ' + err.message);
  }
}

function confirmarSaida() {
  document.getElementById('modal-saida').style.display = 'flex';
}

async function sairDefinitivo() {
  await salvarRascunhoRapido();
  window.location.href = 'index.html';
}

function fecharModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ============================================
// REVISÃO (Etapa 5)
// ============================================

function gerarResumoRevisao() {
  coletarDadosEtapaAtual();
  const container = document.getElementById('revisao-resumo');
  
  let html = '';
  
  // Imóvel
  html += `<div class="revisao-bloco">
    <h4>🏠 Imóvel</h4>
    <p><strong>${laudoAtual.imovel.tipo || '—'}</strong> — ${laudoAtual.imovel.endereco || '—'}</p>
    <p>${laudoAtual.imovel.bairro || ''} ${laudoAtual.imovel.cidade ? '· ' + laudoAtual.imovel.cidade : ''}</p>
    <p>${laudoAtual.imovel.area_construida || '—'} m² construída · ${laudoAtual.imovel.area_util || '—'} m² útil</p>
  </div>`;
  
  // Solicitante
  if (laudoAtual.solicitante?.nome) {
    html += `<div class="revisao-bloco">
      <h4>👤 Solicitante</h4>
      <p>${laudoAtual.solicitante.nome} ${laudoAtual.solicitante.doc ? '· ' + laudoAtual.solicitante.doc : ''}</p>
    </div>`;
  }
  
  // Cap rate
  if (laudoAtual.cap_rate?.anual) {
    html += `<div class="revisao-bloco">
      <h4>📊 Cap Rate</h4>
      <p><strong>${laudoAtual.cap_rate.anual.toFixed(2)}% a.a.</strong> (${(laudoAtual.cap_rate.anual / 12).toFixed(3)}% a.m.)</p>
      <p>Fonte: ${laudoAtual.cap_rate.fonte || '—'} · Modo: ${laudoAtual.cap_rate.modo}</p>
    </div>`;
  }
  
  // Locação
  if (laudoAtual.locacao?.aluguel_recomendado) {
    html += `<div class="revisao-bloco">
      <h4>🔑 Locação</h4>
      <p>Aluguel recomendado: <strong>${formatarMoeda(laudoAtual.locacao.aluguel_recomendado)}</strong>/mês</p>
      <p>Faixa: ${formatarMoeda(laudoAtual.locacao.min)} a ${formatarMoeda(laudoAtual.locacao.max)}</p>
    </div>`;
  }
  
  // Venda
  if (laudoAtual.venda?.valor_adotado) {
    html += `<div class="revisao-bloco">
      <h4>💰 Venda</h4>
      <p>Valor adotado: <strong>${formatarMoeda(laudoAtual.venda.valor_adotado)}</strong></p>
      <p>Faixa: ${formatarMoeda(laudoAtual.venda.min)} a ${formatarMoeda(laudoAtual.venda.max)}</p>
    </div>`;
  }
  
  container.innerHTML = html;
}

// ============================================
// UTILITÁRIOS
// ============================================

function val(id) { return document.getElementById(id)?.value || ''; }
function num(id) { return parseFloat(val(id)) || 0; }
function setVal(id, v) { 
  const el = document.getElementById(id); 
  if (el && v != null) el.value = v; 
}
function setText(id, v) { 
  const el = document.getElementById(id); 
  if (el) el.textContent = v; 
}

function formatarMoeda(v) {
  if (!v && v !== 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visivel'), 10);
  setTimeout(() => {
    toast.classList.remove('visivel');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}