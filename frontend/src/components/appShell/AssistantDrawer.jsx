import { XMarkIcon } from "@heroicons/react/24/outline";
import AssistantChatPanel from "../AssistantChatPanel.jsx";

export default function AssistantDrawer({ context, request = {}, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
      <div className="w-full max-w-[420px] h-full bg-base-100 border-l border-base-300 shadow-2xl flex flex-col">
        <AssistantChatPanel
          mode="drawer"
          initialContextOverrides={context}
          initialPrompt={request.initialPrompt}
          initialMode={request.initialMode}
          initialIncludeStrategySource={request.initialIncludeStrategySource}
          requestKey={request.requestKey}
          onClose={onClose}
        />
      </div>
      <button
        type="button"
        className="absolute left-4 top-4 btn btn-sm btn-circle bg-base-100/90 border border-base-300"
        onClick={onClose}
        title="Close AI Assistant"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
