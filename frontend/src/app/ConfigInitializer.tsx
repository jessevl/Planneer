"use client";
import { useEffect } from 'react';
import { useConfigStore } from '@/stores/configStore';

/**
 * @component ConfigInitializer
 * @description Fetches global application configuration on mount
 */
export default function ConfigInitializer() {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return null;
}
