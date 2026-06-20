/**
 * PipelineStages Component
 * Displays the progress through AutoQuant validation stages
 */

export default function PipelineStages({ currentStage, progress }) {
  const stages = [
    { id: 'discovery', name: 'Discovery', description: 'Find potential edges' },
    { id: 'validation', name: 'Validation', description: 'Remove weak candidates' },
    { id: 'elite_validation', name: 'Elite Validation', description: 'Find deployment-quality strategies' },
    { id: 'ranking', name: 'Elite Ranking', description: 'Score and rank strategies' },
  ];

  const getStageStatus = (stageId) => {
    const stageIndex = stages.findIndex(s => s.id === stageId);
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Pipeline Progress</h2>
        
        <div className="steps steps-vertical lg:steps-horizontal">
          {stages.map((stage) => {
            const status = getStageStatus(stage.id);
            return (
              <div key={stage.id} className={`step ${status === 'completed' ? 'step-primary' : ''}`}>
                <div className="text-center">
                  <div className="font-bold">{stage.name}</div>
                  <div className="text-xs opacity-70">{stage.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {currentStage && (
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <progress 
              className="progress progress-primary w-full" 
              value={progress} 
              max="100"
            ></progress>
          </div>
        )}
      </div>
    </div>
  );
}
