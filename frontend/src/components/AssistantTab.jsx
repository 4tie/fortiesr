import AssistantChatPanel from "./AssistantChatPanel.jsx";

export default function AssistantTab() {
  return (
    <div className="h-full overflow-hidden">
      <AssistantChatPanel mode="page" initialContextOverrides={{ active_tab: "ai-assistant" }} />
    </div>
  );
}
