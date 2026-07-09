import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "@heroicons/react/24/outline";

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  threshold, 
  isHigherBetter = true,
  trend = null,
  format = "number",
  decimals = 2 
}) => {
  const getMetricColor = (val, thresh, higherBetter) => {
    if (higherBetter) {
      if (val >= thresh * 1.1) return "text-success";
      if (val >= thresh) return "text-primary";
      return "text-error";
    } else {
      if (val <= thresh * 0.9) return "text-success";
      if (val <= thresh) return "text-primary";
      return "text-error";
    }
  };

  const formatValue = (val) => {
    if (typeof val !== "number") return "N/A";
    
    switch (format) {
      case "currency":
        return `$${val.toFixed(0)}`;
      case "percentage":
        return `${val.toFixed(decimals)}%`;
      case "ratio":
        return val.toFixed(decimals);
      default:
        return val.toFixed(decimals);
    }
  };

  const getTrendIcon = () => {
    if (trend === null) return null;
    if (trend > 0) return <ArrowUpIcon className="w-4 h-4 text-success" />;
    if (trend < 0) return <ArrowDownIcon className="w-4 h-4 text-error" />;
    return <MinusIcon className="w-4 h-4 text-base-content/50" />;
  };

  const colorClass = threshold !== undefined 
    ? getMetricColor(value, threshold, isHigherBetter)
    : value > 0 ? "text-success" : "text-error";

  return (
    <div className="bg-base-200 border border-base-300 rounded-lg p-5 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-base-content/50 uppercase tracking-wide">
          {title}
        </div>
        {trend !== null && (
          <div className="flex items-center gap-1">
            {getTrendIcon()}
            <span className={`text-xs font-medium ${trend > 0 ? 'text-success' : trend < 0 ? 'text-error' : 'text-base-content/50'}`}>
              {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      
      <div className={`text-2xl font-bold ${colorClass}`}>
        {formatValue(value)}
      </div>
      
      {subtitle && (
        <div className="text-xs text-base-content/40 mt-1">
          {subtitle}
        </div>
      )}
      
      {threshold !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-base-300 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-700 ease-out ${isHigherBetter ? 'bg-success' : 'bg-error'}`}
              style={{ 
                width: `${Math.min(100, Math.max(0, (value / (threshold * (isHigherBetter ? 1.5 : 0.5))) * 100))}%` 
              }}
            />
          </div>
          <div className="text-xs text-base-content/40 mt-1">
            Threshold: {isHigherBetter ? '≥' : '<'}{format === 'percentage' ? threshold.toFixed(0) : threshold}{format === 'percentage' ? '%' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
