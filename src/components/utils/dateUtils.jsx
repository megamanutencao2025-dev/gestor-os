/**
 * Formata uma data no formato YYYY-MM-DD para DD/MM/YYYY sem problemas de timezone
 * @param {string|Date} dateInput - Data no formato YYYY-MM-DD ou objeto Date
 * @param {string} format - Formato de saída ('pt-BR' padrão, 'iso' para YYYY-MM-DD)
 * @returns {string} Data formatada ou string vazia se inválida
 */
export const formatarData = (dateInput, format = 'pt-BR') => {
  if (!dateInput) return '';
  
  try {
    let date;
    
    // Se é string no formato YYYY-MM-DD, parsear como UTC
    if (typeof dateInput === 'string') {
      // Formato YYYY-MM-DD - adicionar horário meio-dia UTC para evitar mudança de dia
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        date = new Date(`${dateInput}T12:00:00Z`);
      } else {
        date = new Date(dateInput);
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return '';
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) return '';
    
    // Retornar no formato solicitado
    if (format === 'iso') {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Formato pt-BR padrão (DD/MM/YYYY)
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.warn('Erro ao formatar data:', error);
    return '';
  }
};

/**
 * Formata data e hora no formato brasileiro
 * @param {string|Date} dateInput - Data/hora
 * @param {boolean} includeSeconds - Incluir segundos
 * @returns {string} Data e hora formatada (DD/MM/YYYY HH:MM ou DD/MM/YYYY HH:MM:SS)
 */
export const formatarDataHora = (dateInput, includeSeconds = false) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const minuto = String(date.getMinutes()).padStart(2, '0');
    
    if (includeSeconds) {
      const segundo = String(date.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    }
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  } catch (error) {
    console.warn('Erro ao formatar data/hora:', error);
    return '';
  }
};

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 * @param {string} dateStr - Data no formato DD/MM/YYYY
 * @returns {string} Data no formato YYYY-MM-DD
 */
export const converterParaISO = (dateStr) => {
  if (!dateStr) return '';
  
  try {
    // Se já está em formato ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Converter de DD/MM/YYYY para YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [dia, mes, ano] = dateStr.split('/');
      return `${ano}-${mes}-${dia}`;
    }
    
    return '';
  } catch (error) {
    console.warn('Erro ao converter data para ISO:', error);
    return '';
  }
};

/**
 * Calcula diferença entre duas datas em dias
 * @param {string|Date} data1 - Data inicial
 * @param {string|Date} data2 - Data final
 * @returns {number} Diferença em dias
 */
export const diferencaEmDias = (data1, data2) => {
  try {
    const d1 = typeof data1 === 'string' ? new Date(`${data1}T12:00:00Z`) : new Date(data1);
    const d2 = typeof data2 === 'string' ? new Date(`${data2}T12:00:00Z`) : new Date(data2);
    
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.warn('Erro ao calcular diferença de datas:', error);
    return 0;
  }
};

/**
 * Retorna a data atual no formato YYYY-MM-DD
 * @returns {string} Data atual
 */
export const dataAtual = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

/**
 * Valida se uma string é uma data válida
 * @param {string} dateStr - String de data
 * @returns {boolean} True se válida
 */
export const validarData = (dateStr) => {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};