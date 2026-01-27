// src/hooks/usePersistedState.ts
import { useState, useEffect } from 'react';

export function usePersistedState<T>(key: string, defaultValue: T) {
  // Criar o estado
  const [state, setState] = useState<T>(() => {
    try {
      // Tentar carregar do localStorage
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      // Se der erro, usar valor padrão
      return defaultValue;
    }
  });

  // Sempre que o estado mudar, salvar no localStorage
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}