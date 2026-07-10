import { useState, useEffect, useCallback } from "react";
import { getSettings, updateSettings, type SettingsMap } from "@/lib/api";

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (key: string, value: string) => {
    setSaving(true);
    try {
      const result = await updateSettings({ [key]: value });
      setSettings(result);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, update, reload: load };
}
