import { useEffect, useRef, useState } from 'react';
import type { PastConversation } from '../../../../shared/claudeChat';
import { ClaudeLogo } from '../../../../renderer/components/ClaudeLogo';
import { baseName, useWorkspace } from '../../../../renderer/core/workspaceStore';
import type { ChatItem, ChatState } from './chatTypes';
import { Banners } from './Banners';
import { Composer } from './Composer';
import { useDraft } from './useDraft';
import { QueuedMessages, useMessageQueue } from './QueuedMessages';
import { LiveCard, TasksCard } from './LiveCards';
import { Markdown } from './Markdown';
import { PermissionCard, QuestionCard } from './RequestCards';
import { ToolRow } from './ToolRow';
import type { ChatSession } from './useChatSession';

const STICK_TO_BOTTOM_PX = 80;

function timeAgo(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/** Empty tab: what you can do, and the folder's recent conversations to pick up again. */
function EmptyState({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const folder = useWorkspace((state) => state.folder);
  const [past, setPast] = useState<PastConversation[] | null>(null);
  useEffect(() => {
    void window.vision.chat.list().then(setPast);
  }, []);
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col items-start gap-2">
        <ClaudeLogo size={28} />
        <div className="display">What should we work on?</div>
        <div className="caption">Claude works in {baseName(folder)}. Drop a file from the sidebar to mention it.</div>
      </div>
      {past === null && <div className="spinner" aria-label="Loading conversations" />}
      {past && past.length > 0 && (
        <div className="flex flex-col">
          <div className="section-label px-2">Recent conversations</div>
          {past.slice(0, 8).map((item) => (
            <button key={item.sessionId} className="row h-9 w-full text-left" onClick={() => onOpen(item.sessionId)}>
              <ClaudeLogo size={14} dim />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="caption shrink-0">{timeAgo(item.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Item({ item, state }: { item: ChatItem; state: ChatState }) {
  if (item.kind === 'user') {
    return (
      <div className="user-bubble enter">
        {item.images?.map((src, index) => <img key={index} className="bubble-image" src={src} alt={`Sent image ${index + 1}`} />)}
        {item.text}
      </div>
    );
  }
  if (item.kind === 'text') return <div className={item.streaming ? 'assistant-text streaming' : 'assistant-text'}><Markdown text={item.text} /></div>;
  if (item.kind === 'notice') return <div className="notice" data-tone={item.tone}>{item.text}</div>;
  const tool = state.tools[item.toolId];
  return tool && tool.name !== 'AskUserQuestion' ? <ToolRow tool={tool} /> : null;
}

/** Keeps the newest message in view while you're at the bottom; leaves you alone if you scrolled up. */
function useStickToBottom(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    const element = ref.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [dependency]);
  const onScroll = () => {
    const element = ref.current;
    if (element) atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_PX;
  };
  return { ref, onScroll };
}

/** A Claude conversation as a chat, like Claude Code in VS Code. */
export function ChatView({ chat }: { chat: ChatSession }) {
  const { state } = chat;
  const { ref: scrollRef, onScroll } = useStickToBottom(state);
  const waiting = state.permissions.length > 0 || state.questions.length > 0;
  const working = state.phase === 'working';
  const draft = useDraft();
  const ready = state.phase === 'idle' && !waiting;
  const queue = useMessageQueue(ready, chat.send);

  return (
    <div className="flex h-full min-h-0 flex-col" onDragOver={draft.onDragOver} onDrop={draft.onDrop}>
      <div ref={scrollRef} onScroll={onScroll} className="reading-surface min-h-0 flex-1 overflow-y-auto">
        {state.items.length === 0 && state.phase !== 'starting' ? (
          <EmptyState onOpen={(sessionId) => chat.open(sessionId)} />
        ) : (
          <div className="chat-column">
            {state.items.map((item) => <Item key={item.key} item={item} state={state} />)}
          </div>
        )}
      </div>
      <div className="chat-dock">
        {state.questions.map((request) => (
          <QuestionCard
            key={request.requestId}
            request={request}
            onAnswer={(answers) => chat.allow(request.requestId, { ...request.input, answers })}
          />
        ))}
        {state.permissions.map((request) => (
          <PermissionCard
            key={request.requestId}
            request={request}
            onAllow={() => chat.allow(request.requestId, request.input)}
            onDeny={() => chat.deny(request.requestId)}
          />
        ))}
        {working && !waiting && <LiveCard activity={state.activity} />}
        {state.todos.length > 0 && <TasksCard todos={state.todos} />}
        <QueuedMessages queue={queue.queue} onRemove={queue.remove} />
        <Banners servers={state.info.mcpServers} />
        <Composer
          draft={draft}
          working={working}
          disabled={state.phase === 'stopped' || state.phase === 'starting'}
          mode={chat.mode}
          info={state.info}
          model={chat.model}
          onSend={(text, images) => (working || queue.queue.length > 0 ? queue.add(text, images) : chat.send(text, images))}
          onModelChange={chat.setModel}
          effort={chat.effort}
          onEffortChange={chat.setEffort}
          onStop={chat.interrupt}
          onModeChange={chat.setMode}
        />
      </div>
    </div>
  );
}
