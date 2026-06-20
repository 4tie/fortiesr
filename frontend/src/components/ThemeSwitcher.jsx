import { useTheme } from "../hooks/useTheme.js";

export default function ThemeSwitcher() {
  const { theme, setTheme, themes, currentTheme } = useTheme();

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        className="btn btn-ghost btn-sm gap-2 font-normal"
        aria-label="Switch theme"
      >
        <span className="text-base leading-none">{currentTheme.icon}</span>
        <span className="text-xs hidden sm:inline text-base-content/70">{currentTheme.label}</span>
        <svg
          className="w-3 h-3 text-base-content/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-200 border border-base-300 rounded-box shadow-xl z-50 w-52 mt-1 p-1 gap-0.5"
      >
        {themes.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors ${
                theme === t.id
                  ? "bg-primary/15 text-primary font-medium"
                  : "hover:bg-base-300/60 text-base-content/70 hover:text-base-content"
              }`}
            >
              <span className="text-base leading-none w-5 text-center">{t.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium leading-tight">{t.label}</span>
                <span className="text-[10px] text-base-content/40 leading-tight truncate">
                  {t.description}
                </span>
              </div>
              {theme === t.id && (
                <span className="ml-auto text-primary text-xs">✓</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
