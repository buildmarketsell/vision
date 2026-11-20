import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import type { PastConversation } from '../../../../shared/claudeChat';
import { ClaudeLogo } from '../../../../renderer/components/ClaudeLogo';
import { CopyButton } from '../../../../renderer/components/CopyButton';
import { baseName, useWorkspace } from '../../../../renderer/core/workspaceStore';
import type { ChatItem, ChatState } from './chatTypes';
import { Banners } from './Banners';
import { Composer } from './Composer';
import { useDraft } from './useDraft';
import { WorkingLine, TasksCard } from './LiveCards';
import { Markdown } from './Markdown';
import { PermissionCard, QuestionCard } from './RequestCards';
import { ToolRow } from './ToolRow';
import type { ChatSession } from './useChatSession';
import { timeAgo } from '../timeAgo';
import { isLastTextOfAnswer, textForDocument } from './copyText';

const STICK_TO_BOTTOM_PX = 80;

/** Empty tab: what you can do, and the folder's recent conversations to pick up again. */
function EmptyState({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const folder = useWorkspace((state) => state.folder);
  const [past, setPast] = useState<PastConversation[] | null>(null);
  useEffect(() => {
    void window.vision.chat.list().then(setPast);
  }, []);
  return (
    <div className="chat-empty">
      <div className="flex flex-col items-start gap-2 px-2">
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

function Item({ item, state, lastOfAnswer }: { item: ChatItem; state: ChatState; lastOfAnswer: boolean }) {
  const folder = useWorkspace((current) => current.folder);
  if (item.kind === 'user') {
    return (
      <div className="user-bubble enter">
        {item.images?.map((src, index) => <img key={index} className="bubble-image" src={src} alt={`Sent image ${index + 1}`} />)}
        {item.text}
      </div>
    );
  }
  if (item.kind === 'text') {
    return (
      <div className={item.streaming ? 'assistant-text streaming' : 'assistant-text'} data-reply={item.key}>
        <Markdown text={item.text} baseDir={folder} />
        {!item.streaming && lastOfAnswer && <CopyButton className="copy-reply" label="Copy reply" getText={() => replyText(item.key)} />}
      </div>
    );
  }
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

/** Copies chat text without its styling (so Google Docs or Word use their own font and sizes) and with one empty line between paragraphs. */
/** A reply as it reads on screen, cleaned for a document (one empty line between paragraphs), without the code blocks' buttons. */
function replyText(key: string): string {
  const markdown = document.querySelector(`[data-reply="${CSS.escape(key)}"] .markdown`);
  return markdown instanceof HTMLElement ? textForDocument(markdown.innerText) : '';
}

function copyAsPlainText(event: ClipboardEvent) {
  const text = window.getSelection()?.toString();
  if (!text) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', textForDocument(text));
}

/** A Claude conversation as a chat, like Claude Code in VS Code. */
export function ChatView({ chat }: { chat: ChatSession }) {
  const { state } = chat;
  const { ref: scrollRef, onScroll } = useStickToBottom(state);
  const waiting = state.permissions.length > 0 || state.questions.length > 0;
  const working = state.phase === 'working';
  const draft = useDraft();

  return (
    <div className="flex h-full min-h-0 flex-col" onDragOver={draft.onDragOver} onDrop={draft.onDrop}>
      <div ref={scrollRef} onScroll={onScroll} onCopy={copyAsPlainText} className="reading-surface min-h-0 flex-1 overflow-y-auto">
        {state.items.length === 0 && state.phase !== 'starting' ? (
          <EmptyState onOpen={(sessionId) => chat.open(sessionId)} />
        ) : (
          <div className="chat-column">
            {state.items.map((item, index) => <Item key={item.key} item={item} state={state} lastOfAnswer={isLastTextOfAnswer(state.items, index)} />)}
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
        {working && !waiting && <WorkingLine />}
        {state.todos.length > 0 && <TasksCard todos={state.todos} />}
        <Banners servers={state.info.mcpServers} />
        <Composer
          draft={draft}
          working={working}
          disabled={state.phase === 'stopped' || state.phase === 'starting'}
          mode={chat.mode}
          info={state.info}
          model={chat.model}
          onSend={chat.send}
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
