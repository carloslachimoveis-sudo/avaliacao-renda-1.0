// ============================================
// MÓDULO DE GERAÇÃO DE REFERÊNCIAS AUTOMÁTICAS
// ============================================
// Formato: PREFIXO-AAAA-NNNN
// Exemplos: LA-2026-0001, CR-2026-0012

/**
 * Gera uma nova referência sequencial para o ano corrente
 * @param {string} tipo - Prefixo: 'LA' (laudo), 'CR' (cap rate avulso), 'OR' (orçamento)
 * @returns {string} Referência no formato TIPO-AAAA-NNNN
 */
function gerarReferencia(tipo = 'LA') {
  const ano = new Date().getFullYear();
  const chaveSequencia = `sequencia_${tipo}_${ano}`;
  
  // Busca o último número usado (ou começa em 0)
  let sequencia = parseInt(localStorage.getItem(chaveSequencia) || '0', 10);
  sequencia += 1;
  
  // Persiste o novo valor
  localStorage.setItem(chaveSequencia, sequencia.toString());
  
  // Formata com 4 dígitos (0001, 0002, ... 9999)
  const sequenciaFormatada = sequencia.toString().padStart(4, '0');
  
  return `${tipo}-${ano}-${sequenciaFormatada}`;
}

/**
 * Retorna a próxima referência que seria gerada (sem incrementar)
 * Útil para pré-visualização em modais
 */
function previsualizarReferencia(tipo = 'LA') {
  const ano = new Date().getFullYear();
  const chaveSequencia = `sequencia_${tipo}_${ano}`;
  const sequenciaAtual = parseInt(localStorage.getItem(chaveSequencia) || '0', 10);
  const proxima = (sequenciaAtual + 1).toString().padStart(4, '0');
  return `${tipo}-${ano}-${proxima}`;
}

/**
 * Valida se uma referência está no formato correto
 */
function validarReferencia(ref) {
  const regex = /^[A-Z]{2}-\d{4}-\d{4}$/;
  return regex.test(ref);
}

/**
 * Extrai componentes de uma referência
 * @returns {object} { tipo, ano, numero }
 */
function decomporReferencia(ref) {
  if (!validarReferencia(ref)) return null;
  const partes = ref.split('-');
  return {
    tipo: partes[0],
    ano: parseInt(partes[1], 10),
    numero: parseInt(partes[2], 10)
  };
}

/**
 * Lista todas as referências já usadas em um ano/tipo
 * (útil para evitar duplicidade em migrações)
 */
function listarReferenciasUsadas(tipo, ano) {
  const chaveSequencia = `sequencia_${tipo}_${ano}`;
  const total = parseInt(localStorage.getItem(chaveSequencia) || '0', 10);
  const refs = [];
  for (let i = 1; i <= total; i++) {
    refs.push(`${tipo}-${ano}-${i.toString().padStart(4, '0')}`);
  }
  return refs;
}

/**
 * Reseta a sequência de um tipo/ano (use com cuidado!)
 * Apenas para testes ou correções
 */
function resetarSequencia(tipo, ano) {
  const chaveSequencia = `sequencia_${tipo}_${ano}`;
  localStorage.removeItem(chaveSequencia);
}

// ============================================
// CONSTANTES DE TIPOS
// ============================================

const TIPOS_REFERENCIA = {
  LA: { nome: 'Laudo/Parecer', descricao: 'Avaliações completas' },
  CR: { nome: 'Cap Rate Avulso', descricao: 'Levantamentos rápidos de taxa' },
  OR: { nome: 'Orçamento', descricao: 'Orçamentos de avaliação' }
};