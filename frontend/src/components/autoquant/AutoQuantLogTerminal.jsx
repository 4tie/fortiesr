import { useEffect, useRef } from "react";

export default function AutoQuantLogTerminal({ lines, filter }) {
  const containerRef = useRef(null);
  const filterLower = filter ? filter.toLowerCase() : "";
  const displayed = filterLower
    ? lines.filter((l) => l.toLowerCase().includes(filterLower))
    : lines;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div ref={containerRef} className="bg-base-300 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
      {displayed.length === 0 ? (
        <span className="text-base-content/30">
          {filterLower ? "No lines match filter." : "Waiting for pipeline output..."}
        </span>
      ) : (
        displayed.slice(-1000).map((line, i) => (
          <div
            key={i}
            className={`${
              line.includes("ERROR") || line.includes("error") || line.includes("✗")
                ? "text-error"
                : line.includes("✓") || line.includes("passed") || line.includes("complete")
                ? "text-success"
                : line.includes("WARNING") || line.includes("warning")
                ? "text-warning"
                : "text-base-content/70"
            }`}
          >
            {line}
          </div>
        ))
      )}
    </div>
  );
}
