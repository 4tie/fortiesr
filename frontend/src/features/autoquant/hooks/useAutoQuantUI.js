import { useState, useCallback } from "react";

export default function useAutoQuantUI() {
  const [showHyperopt, setShowHyperopt] = useState(false);
  const [showEnsemble, setShowEnsemble] = useState(false);
  const [logFilter, setLogFilter] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem("aq_notif_enabled") === "true"; } catch { return false; }
  });

  const toggleNotif = useCallback(() => {
    setNotifEnabled((prev) => {
      const newValue = !prev;
      try { localStorage.setItem("aq_notif_enabled", String(newValue)); } catch (err) {
        console.debug("Failed to persist notification setting:", err);
      }
      return newValue;
    });
  }, []);

  return {
    showHyperopt,
    setShowHyperopt,
    showEnsemble,
    setShowEnsemble,
    logFilter,
    setLogFilter,
    notifEnabled,
    setNotifEnabled,
    toggleNotif,
  };
}
