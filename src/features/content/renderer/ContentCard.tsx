import { useEffect, useState } from 'react';
import { growth, PLATFORMS, type ContentState, type Platform } from '../../../shared/content';
import { shortNumber, signed } from './format';

const NAMES: Record<Platform, { name: string; unit: string }> = { youtube: { name: 'YouTube', unit: 'subscribers' }, instagram: { name: 'Instagram', unit: 'followers' } };

/** Dashboard card: followers on each connected platform and the last week's change. */
export function ContentCard() {
  const [state, setState] = useState<ContentState | null>(null);
  useEffect(() => {
    void window.vision.content.state().then(setState, () => setState(null));
  }, []);
  if (!state) return <div className="caption">Loading…</div>;
  const connected = PLATFORMS.filter((platform) => state[platform].connected);
  if (connected.length === 0) return <div className="caption">Connect YouTube or Instagram on the Content page.</div>;
  return (
    <div className="flex gap-8">
      {connected.map((platform) => {
        const platformState = state[platform];
        if (!platformState.connected) return null;
        const week = signed(growth(platformState.history, 7, (snapshot) => snapshot.followers));
        return (
          <div key={platform} className="flex flex-col gap-1">
            <span className="caption">{NAMES[platform].name}</span>
            <span className="dash-big">{shortNumber(platformState.stats?.followers ?? null)}</span>
            <span className="caption">{NAMES[platform].unit}{week ? ` · ${week} this week` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
