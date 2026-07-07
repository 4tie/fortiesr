import { useState } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";

export default function DiffViewer({ 
  originalContent, 
  newContent, 
  filePath, 
  onApply, 
  onCancel,
  isApplying = false 
}) {
  const [viewMode, setViewMode] = useState("unified"); // "unified" or "side-by-side"

  const simpleDiff = () => {
    const lines = [];
    lines.push(`--- ${filePath} (original)`);
    lines.push(`+++ ${filePath} (modified)`);
    lines.push("@@ Changes @@");
    
    if (originalContent === newContent) {
      lines.push(" No changes detected");
      return lines.join("\n");
    }

    const originalLines = originalContent.split("\n");
    const newLines = newContent.split("\n");
    const maxLines = Math.max(originalLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || "";
      const newLine = newLines[i] || "";

      if (originalLine !== newLine) {
        if (originalLine) lines.push(`- ${originalLine}`);
        if (newLine) lines.push(`+ ${newLine}`);
      }
    }

    return lines.join("\n");
  };

  const diffText = simpleDiff();
  const hasChanges = originalContent !== newContent;

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-2 bg-base-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-base-content">File Changes</span>
          <span className="text-xs text-base-content/50 font-mono">{filePath}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-xs"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="unified">Unified</option>
            <option value="side-by-side">Side by Side</option>
          </select>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={onCancel}
            title="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {viewMode === "unified" ? (
          <pre className="text-xs font-mono bg-base-200/50 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap break-all">
            {diffText}
          </pre>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>

              <div className="text-xs font-semibold text-error mb-2">Original</div>
              <pre className="text-xs font-mono bg-error/5 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap break-all border border-error/20">
                {originalContent || "(empty)"}
              </pre>
            </div>
            <div>
              <div className="text-xs font-semibold text-success mb-2">Modified</div>
              <pre className="text-xs font-mono bg-success/5 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap break-all border border-success/20">
                {newContent || "(empty)"}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-base-300 px-4 py-3 bg-base-200">
        <button
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          disabled={isApplying}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onApply}
          disabled={!hasChanges || isApplying}
        >
          {isApplying ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Applying...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4" />
              Apply Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
