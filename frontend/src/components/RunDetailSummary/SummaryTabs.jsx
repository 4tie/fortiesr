const SummaryTabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="bg-base-100 border border-base-300 rounded-lg p-1 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 min-w-[120px] px-4 py-3 font-medium text-sm transition-all duration-200 rounded-md ${
              activeTab === tab.id
                ? "bg-primary text-primary-content shadow-md transform scale-[1.02]"
                : "text-base-content/70 hover:text-base-content hover:bg-base-200"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SummaryTabs;
