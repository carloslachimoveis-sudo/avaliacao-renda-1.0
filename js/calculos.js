// ============================================
// CÁLCULOS — Locação e Venda
// ============================================

function calcularLocacao(dados) {
  const base = dados.aluguel_base || 0;
  const ajustePerc = dados.ajuste_mobilia || 0;
  const ajusteValor = base * (ajustePerc / 100);
  const brutoAjustado = base + ajusteValor;
  
  const vacancia = brutoAjustado * ((dados.vacancia || 0) / 100);
  const admin = brutoAjustado * ((dados.admin || 0) / 100);
  const iptu = dados.iptu || 0;
  
  const liquido = brutoAjustado - vacancia - admin - iptu;
  
  const arbMenos = dados.arb_menos || 0;
  const arbMais = dados.arb_mais || 0;
  const min = liquido * (1 - arbMenos / 100);
  const max = liquido * (1 + arbMais / 100);
  
  return {
    bruto_base: base,
    ajuste_mobilia_valor: ajusteValor,
    bruto_ajustado: brutoAjustado,
    vacancia_valor: vacancia,
    admin_valor: admin,
    iptu_valor: iptu,
    aluguel_liquido: liquido,
    aluguel_recomendado: liquido,
    min,
    max
  };
}

function calcularLocacaoUI() {
  const dados = {
    aluguel_base: num('loc_aluguel_base'),
    ajuste_mobilia: num('loc_ajuste_mobilia'),
    vacancia: num('loc_vacancia'),
    admin: num('loc_admin'),
    iptu: num('loc_iptu'),
    arb_menos: num('loc_arb_menos'),
    arb_mais: num('loc_arb_mais')
  };
  
  const res = calcularLocacao(dados);
  
  setText('loc_res_bruto_base', formatarMoeda(res.bruto_base));
  setText('loc_res_ajuste', formatarMoeda(res.ajuste_mobilia_valor));
  setText('loc_res_bruto_ajustado', formatarMoeda(res.bruto_ajustado));
  setText('loc_res_vacancia', formatarMoeda(res.vacancia_valor));
  setText('loc_res_admin', formatarMoeda(res.admin_valor));
  setText('loc_res_iptu', formatarMoeda(res.iptu_valor));
  setText('loc_res_liquido', formatarMoeda(res.aluguel_liquido));
  setText('loc_res_recomendado', formatarMoeda(res.aluguel_recomendado));
  setText('loc_res_min', formatarMoeda(res.min));
  setText('loc_res_max', formatarMoeda(res.max));
}

function calcularVenda(dados) {
  const aluguel = dados.aluguel || 0;
  const capRate = dados.cap_rate || 0;
  const anual = aluguel * 12;
  
  let valorCalculado = 0;
  if (capRate > 0) {
    valorCalculado = anual / (capRate / 100);
  }
  
  // Ajustes
  const ajEdificacoes = dados.aj_edificacoes || 0;
  const ajInhabitavel = dados.aj_inhabitavel || 0;
  const ajReforma = dados.aj_reforma || 0;
  const ajBenfeitorias = dados.aj_benfeitorias || 0;
  const ajOfertaPerc = dados.aj_oferta || 0;
  
  const subtotal = valorCalculado - ajEdificacoes - ajInhabitavel - ajReforma + ajBenfeitorias;
  const ajOfertaValor = subtotal * (ajOfertaPerc / 100);
  const valorAjustado = subtotal + ajOfertaValor;
  const totalAjustes = valorAjustado - valorCalculado;
  
  const valorAdotado = dados.valor_adotado || valorAjustado;
  const arbMenos = dados.arb_menos || 0;
  const arbMais = dados.arb_mais || 0;
  const min = valorAdotado * (1 - arbMenos / 100);
  const max = valorAdotado * (1 + arbMais / 100);
  
  return {
    anual,
    valor_calculado: valorCalculado,
    total_ajustes: totalAjustes,
    valor_ajustado: valorAjustado,
    valor_adotado: valorAdotado,
    min,
    max
  };
}

function calcularVendaUI() {
  const dados = {
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
  
  const res = calcularVenda(dados);
  
  setText('venda_res_anual', formatarMoeda(res.anual));
  setText('venda_res_cap', dados.cap_rate ? dados.cap_rate.toFixed(2) + '% a.a.' : '—');
  setText('venda_res_calculado', formatarMoeda(res.valor_calculado));
  setText('venda_res_base', formatarMoeda(res.valor_calculado));
  setText('venda_res_ajustes_total', formatarMoeda(res.total_ajustes));
  setText('venda_res_ajustado', formatarMoeda(res.valor_ajustado));
  
  // Se o corretor ainda não preencheu o valor adotado, sugere o ajustado
  if (!val('venda_valor_adotado')) {
    setVal('venda_valor_adotado', res.valor_ajustado.toFixed(2));
    dados.valor_adotado = res.valor_ajustado;
  }
  
  const adotado = parseFloat(val('venda_valor_adotado')) || 0;
  const min = adotado * (1 - (dados.arb_menos || 0) / 100);
  const max = adotado * (1 + (dados.arb_mais || 0) / 100);
  
  setText('venda_res_adotado', formatarMoeda(adotado));
  setText('venda_res_min', formatarMoeda(min));
  setText('venda_res_max', formatarMoeda(max));
}

function formatarMoeda(v) {
  if (!v && v !== 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}