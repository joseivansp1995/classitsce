/**
 * Copia texto al portapapeles de manera segura, con soporte para contextos HTTP no seguros
 * (como http://192.168.x.x en redes locales móviles donde navigator.clipboard es undefined).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Intentar la API moderna navigator.clipboard si está disponible (HTTPS o localhost)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText falló, intentando fallback execCommand:', err);
    }
  }

  // 2. Fallback con textarea temporal para contextos HTTP no seguros (IP local en móviles)
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Prevenir saltos de scroll o zoom en dispositivos móviles
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback execCommand copy falló:', err);
      return false;
    }
  }

  return false;
}

