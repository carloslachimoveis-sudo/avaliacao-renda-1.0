// ============================================
// MÓDULO DE BANCO DE DADOS — IndexedDB
// ============================================
// Armazena laudos e amostras de forma estruturada,
// permitindo consultas, filtros e escalabilidade.

const DB_CONFIG = {
  nome: 'avaliacoes_db',
  versao: 1,
  stores: ['laudos', 'amostras_avulsas', 'config']
};

let _dbInstance = null;

// ============================================
// ABERTURA DO BANCO
// ============================================

function abrirDB() {
  if (_dbInstance) return Promise.resolve(_dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.nome, DB_CONFIG.versao);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // STORE: LAUDOS
      if (!db.objectStoreNames.contains('laudos')) {
        const storeLaudos = db.createObjectStore('laudos', { 
          keyPath: 'referencia' 
        });
        storeLaudos.createIndex('status', 'status', { unique: false });
        storeLaudos.createIndex('data_criacao', 'data_criacao', { unique: false });
        storeLaudos.createIndex('data_finalizacao', 'data_finalizacao', { unique: false });
        storeLaudos.createIndex('cidade', 'imovel.cidade', { unique: false });
        storeLaudos.createIndex('tipo', 'imovel.tipo', { unique: false });
        storeLaudos.createIndex('finalidade', 'finalidade', { unique: false });
      }
      
      // STORE: AMOSTRAS AVULSAS (cap rates levantados sem laudo completo)
      if (!db.objectStoreNames.contains('amostras_avulsas')) {
        const storeAmostras = db.createObjectStore('amostras_avulsas', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        storeAmostras.createIndex('cidade', 'cidade', { unique: false });
        storeAmostras.createIndex('bairro', 'bairro', { unique: false });
        storeAmostras.createIndex('tipo_imovel', 'tipo_imovel', { unique: false });
        storeAmostras.createIndex('cap_rate', 'cap_rate_anual', { unique: false });
        storeAmostras.createIndex('data', 'data_referencia', { unique: false });
      }
      
      // STORE: CONFIGURAÇÕES (perfil do corretor, cap rates padrão)
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'chave' });
      }
    };
    
    request.onsuccess = (event) => {
      _dbInstance = event.target.result;
      resolve(_dbInstance);
    };
    
    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ============================================
// OPERAÇÕES GENÉRICAS (CRUD)
// ============================================

async function dbPut(storeName, data) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, key) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbClear(storeName) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// OPERAÇÕES ESPECÍFICAS — LAUDOS
// ============================================

/**
 * Salva um laudo (rascunho ou finalizado)
 */
async function salvarLaudo(laudo) {
  // Garante campos obrigatórios
  laudo.data_atualizacao = new Date().toISOString();
  if (!laudo.data_criacao) {
    laudo.data_criacao = laudo.data_atualizacao;
  }
  if (!laudo.status) {
    laudo.status = 'rascunho';
  }
  await dbPut('laudos', laudo);
  return laudo;
}

/**
 * Busca um laudo pela referência
 */
async function buscarLaudo(referencia) {
  return await dbGet('laudos', referencia);
}

/**
 * Lista todos os laudos (ordenados por data, mais recentes primeiro)
 */
async function listarLaudos() {
  const laudos = await dbGetAll('laudos');
  return laudos.sort((a, b) => 
    new Date(b.data_atualizacao) - new Date(a.data_atualizacao)
  );
}

/**
 * Lista os N laudos mais recentes
 */
async function buscarLaudosRecentes(limite = 5) {
  const laudos = await listarLaudos();
  return laudos.slice(0, limite);
}

/**
 * Lista laudos por status
 */
async function listarLaudosPorStatus(status) {
  const laudos = await dbGetAll('laudos');
  return laudos
    .filter(l => l.status === status)
    .sort((a, b) => new Date(b.data_atualizacao) - new Date(a.data_atualizacao));
}

/**
 * Finaliza um laudo e o promove a amostra reutilizável
 */
async function finalizarLaudo(referencia) {
  const laudo = await buscarLaudo(referencia);
  if (!laudo) throw new Error('Laudo não encontrado');
  
  laudo.status = 'finalizado';
  laudo.data_finalizacao = new Date().toISOString();
  laudo.amostra_valida = validarAmostra(laudo);
  
  await salvarLaudo(laudo);
  return laudo;
}

/**
 * Valida se um laudo pode virar amostra reutilizável
 */
function validarAmostra(laudo) {
  // Critérios mínimos para ser amostra válida
  if (laudo.status !== 'finalizado') return false;
  if (!laudo.cap_rate?.anual || laudo.cap_rate.anual <= 0) return false;
  if (!laudo.imovel?.cidade) return false;
  if (!laudo.imovel?.tipo) return false;
  if (!laudo.locacao?.aluguel_liquido && !laudo.venda?.valor_adotado) return false;
  return true;
}

/**
 * Exclui um laudo
 */
async function excluirLaudo(referencia) {
  await dbDelete('laudos', referencia);
}

// ============================================
// OPERAÇÕES ESPECÍFICAS — AMOSTRAS
// ============================================

/**
 * Busca todas as amostras válidas (laudos finalizados + amostras avulsas)
 * com filtros opcionais
 */
async function buscarAmostras(filtros = {}) {
  const amostras = [];
  
  // 1. Amostras vindas de laudos finalizados
  const laudos = await dbGetAll('laudos');
  laudos.forEach(l => {
    if (l.status === 'finalizado' && l.amostra_valida) {
      amostras.push({
        origem: 'laudo',
        referencia: l.referencia,
        cidade: l.imovel?.cidade,
        bairro: l.imovel?.bairro,
        tipo_imovel: l.imovel?.tipo,
        area_m2: l.imovel?.area_m2,
        padrao: l.imovel?.padrao,
        conservacao: l.imovel?.conservacao,
        cap_rate_anual: l.cap_rate?.anual,
        cap_rate_mensal: l.cap_rate?.mensal,
        aluguel: l.locacao?.aluguel_liquido,
        venda: l.venda?.valor_adotado,
        data: l.data_finalizacao,
        fonte: l.cap_rate?.fonte
      });
    }
  });
  
  // 2. Amostras avulsas (cap rates levantados sem laudo completo)
  const avulsas = await dbGetAll('amostras_avulsas');
  avulsas.forEach(a => {
    amostras.push({
      origem: 'avulsa',
      id: a.id,
      cidade: a.cidade,
      bairro: a.bairro,
      tipo_imovel: a.tipo_imovel,
      area_m2: a.area_m2,
      cap_rate_anual: a.cap_rate_anual,
      aluguel: a.aluguel,
      venda: a.valor_venda,
      data: a.data_referencia,
      fonte: a.fonte,
      observacoes: a.observacoes
    });
  });
  
  // Aplica filtros
  let resultado = amostras;
  
  if (filtros.cidade) {
    resultado = resultado.filter(a => a.cidade === filtros.cidade);
  }
  if (filtros.bairro) {
    resultado = resultado.filter(a => a.bairro === filtros.bairro);
  }
  if (filtros.tipo_imovel) {
    resultado = resultado.filter(a => a.tipo_imovel === filtros.tipo_imovel);
  }
  if (filtros.dataInicio) {
    const inicio = new Date(filtros.dataInicio);
    resultado = resultado.filter(a => new Date(a.data) >= inicio);
  }
  if (filtros.dataFim) {
    const fim = new Date(filtros.dataFim);
    resultado = resultado.filter(a => new Date(a.data) <= fim);
  }
  if (filtros.capRateMin != null) {
    resultado = resultado.filter(a => a.cap_rate_anual >= filtros.capRateMin);
  }
  if (filtros.capRateMax != null) {
    resultado = resultado.filter(a => a.cap_rate_anual <= filtros.capRateMax);
  }
  
  // Ordena por data (mais recente primeiro)
  resultado.sort((a, b) => new Date(b.data) - new Date(a.data));
  
  return resultado;
}

/**
 * Adiciona uma amostra avulsa (cap rate levantado em campo sem laudo completo)
 */
async function adicionarAmostraAvulsa(amostra) {
  amostra.data_cadastro = new Date().toISOString();
  if (!amostra.data_referencia) {
    amostra.data_referencia = amostra.data_cadastro;
  }
  return await dbPut('amostras_avulsas', amostra);
}

/**
 * Estatísticas do banco
 */
async function estatisticasBanco() {
  const amostras = await buscarAmostras();
  
  if (amostras.length === 0) {
    return { total: 0, cidades: 0, capRateMedio: null };
  }
  
  const cidades = new Set(amostras.map(a => a.cidade).filter(Boolean));
  const capRates = amostras.map(a => a.cap_rate_anual).filter(v => v > 0);
  const capRateMedio = capRates.length > 0 
    ? capRates.reduce((s, v) => s + v, 0) / capRates.length 
    : null;
  
  // Agrupa por tipologia
  const porTipo = {};
  amostras.forEach(a => {
    const tipo = a.tipo_imovel || 'não informado';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    if (a.cap_rate_anual > 0) porTipo[tipo].push(a.cap_rate_anual);
  });
  
  const capRatePorTipo = {};
  for (const [tipo, rates] of Object.entries(porTipo)) {
    if (rates.length > 0) {
      capRatePorTipo[tipo] = {
        quantidade: rates.length,
        media: rates.reduce((s, v) => s + v, 0) / rates.length,
        minimo: Math.min(...rates),
        maximo: Math.max(...rates)
      };
    }
  }
  
  return {
    total: amostras.length,
    cidades: cidades.size,
    listaCidades: Array.from(cidades),
    capRateMedio,
    capRatePorTipo
  };
}

// ============================================
// OPERAÇÕES — CONFIGURAÇÕES
// ============================================

async function salvarConfig(chave, valor) {
  await dbPut('config', { chave, valor });
}

async function buscarConfig(chave, padrao = null) {
  const reg = await dbGet('config', chave);
  return reg ? reg.valor : padrao;
}

// ============================================
// BACKUP — EXPORT / IMPORT
// ============================================

async function exportarDados() {
  const laudos = await dbGetAll('laudos');
  const amostras = await dbGetAll('amostras_avulsas');
  const config = await dbGetAll('config');
  
  return {
    versao: '1.0',
    data_exportacao: new Date().toISOString(),
    laudos,
    amostras_avulsas: amostras,
    config
  };
}

async function importarDados(dados) {
  if (!dados.laudos || !Array.isArray(dados.laudos)) {
    throw new Error('Arquivo inválido: campo "laudos" ausente');
  }
  
  // Limpa banco atual (com confirmação prévia no chamador)
  await dbClear('laudos');
  await dbClear('amostras_avulsas');
  await dbClear('config');
  
  // Reimporta
  for (const laudo of dados.laudos) {
    await dbPut('laudos', laudo);
  }
  for (const amostra of (dados.amostras_avulsas || [])) {
    await dbPut('amostras_avulsas', amostra);
  }
  for (const cfg of (dados.config || [])) {
    await dbPut('config', cfg);
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Abre o banco em background assim que o script carrega
abrirDB().then(() => {
  console.log('✅ IndexedDB inicializado');
}).catch(err => {
  console.error('❌ Falha ao inicializar IndexedDB:', err);
});