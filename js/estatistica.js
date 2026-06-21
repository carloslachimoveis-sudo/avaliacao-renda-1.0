// ============================================
// ESTATÍSTICA BÁSICA
// ============================================

function calcularEstatistica(valores) {
  const nums = valores.filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  
  if (nums.length === 0) {
    return { media: 0, mediana: 0, dp: 0, cv: 0, min: 0, max: 0, n: 0 };
  }
  
  const n = nums.length;
  const ordenados = [...nums].sort((a, b) => a - b);
  
  // Média
  const soma = nums.reduce((s, v) => s + v, 0);
  const media = soma / n;
  
  // Mediana
  const mediana = n % 2 === 0
    ? (ordenados[n/2 - 1] + ordenados[n/2]) / 2
    : ordenados[Math.floor(n/2)];
  
  // Desvio padrão (amostral)
  const variancia = nums.reduce((s, v) => s + Math.pow(v - media, 2), 0) / (n > 1 ? n - 1 : 1);
  const dp = Math.sqrt(variancia);
  
  // Coeficiente de variação
  const cv = media > 0 ? dp / media : 0;
  
  return {
    media,
    mediana,
    dp,
    cv,
    min: ordenados[0],
    max: ordenados[n - 1],
    n
  };
}

// Intervalo de confiança de 80% (z = 1.28)
function intervaloConfianca(stats, confianca = 0.80) {
  const z = { 0.80: 1.28, 0.90: 1.645, 0.95: 1.96 }[confianca] || 1.28;
  const erroPadrao = stats.dp / Math.sqrt(stats.n);
  const margem = z * erroPadrao;
  return {
    inferior: stats.media - margem,
    superior: stats.media + margem,
    margem
  };
}