import { useState } from 'react';
import { X } from 'lucide-react';
import { useNow } from '../usage/UsagePanel';
import { useUsage } from '../usage/usageStore';
import { chatBanners } from './chatBanners';
import type { McpServer } from './sessionInfo';

/** Usage and connection bars above the composer. Dismissing one hides it in this tab until its content changes. */
export function Banners({ servers }: { servers: McpServer[] }) {
  const windows = useUsage((usage) => usage.windows);
  const now = useNow();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const banners = chatBanners(windows, servers, now).filter((banner) => !dismissed.includes(banner.id));
  if (banners.length === 0) return null;
  return (
    <div className="chat-banners" role="status">
      {banners.map((banner) => (
        <div key={banner.id} className="chat-banner enter" data-tone={banner.tone}>
          <span className="min-w-0 flex-1">{banner.text}</span>
          <button aria-label="Dismiss" title="Dismiss" onClick={() => setDismissed([...dismissed, banner.id])}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
