import { useContext } from "react";
import { ToastCtx } from "../components/Toast.jsx";

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
