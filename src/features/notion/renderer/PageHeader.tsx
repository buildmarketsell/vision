import { useRef, useState } from 'react';
import { Image, Smile } from 'lucide-react';
import { COVER_COLORS, MAX_COVER_CHARS, type Page } from '../../../shared/pages';
import { anchorOf, Popover, type Anchor } from './Popover';
import { changePage } from './pageStore';

/** A short set of page icons, like the top of Notion's picker. Page content, not interface decoration. */
const ICONS = '📄 📝 📌 📚 💡 🎯 🚀 ⭐ ✅ 🗂️ 📅 💼 💰 📈 🧠 ❤️ 🏠 ✈️ 🎬 📷 🎵 🛒 🍎 🏋️ 🌱 🌍 🔥 ⚙️ 🧪 🎨 📣 🤝 🧘 📖 🗓️ 🏆'.split(' ');
const COVER_WIDTH = 1600;

/** Shrinks a picked picture to a WebP small enough to keep in the page file. */
async function coverFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COVER_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.65, 0.45]) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.length <= MAX_COVER_CHARS) return url;
  }
  throw new Error('too big');
}

export function Cover({ page }: { page: Page }) {
  const [menu, setMenu] = useState<Anchor | null>(null);
  if (!page.cover) return null;
  const isColor = COVER_COLORS.includes(page.cover as (typeof COVER_COLORS)[number]);
  return (
    <div className="notion-cover" data-color={isColor ? page.cover : undefined}>
      {!isColor && <img src={page.cover} alt="" />}
      <div className="notion-cover-actions">
        <button className="notion-cover-button" onClick={(event) => setMenu(anchorOf(event.currentTarget))}>Change cover</button>
        <button className="notion-cover-button" onClick={() => changePage(page.id, (current) => ({ ...current, cover: '' }))}>Remove</button>
      </div>
      {menu && <CoverPicker page={page} anchor={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function CoverPicker({ page, anchor, onClose }: { page: Page; anchor: Anchor; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setCover = (cover: string) => {
    changePage(page.id, (current) => ({ ...current, cover }));
    onClose();
  };
  return (
    <Popover anchor={anchor} width={300} label="Cover" onClose={onClose}>
      <div className="db-menu-hint">Color</div>
      <div className="notion-cover-grid">
        {COVER_COLORS.map((color) => (
          <button key={color} className="notion-cover-swatch" data-color={color} aria-label={`${color} cover`} onClick={() => setCover(color)} />
        ))}
      </div>
      <div className="db-menu-divider" />
      <button className="row w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <span className="spinner" aria-label="Preparing image" /> : <Image size={14} strokeWidth={1.75} />} Upload an image
      </button>
      {error && <div className="db-error">{error}</div>}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          coverFromFile(file).then(setCover, () => {
            setBusy(false);
            setError('That image could not be used. Try a PNG or JPEG.');
          });
        }}
      />
    </Popover>
  );
}

export function IconPicker({ page, anchor, onClose }: { page: Page; anchor: Anchor; onClose: () => void }) {
  const setIcon = (icon: string) => {
    changePage(page.id, (current) => ({ ...current, icon }));
    onClose();
  };
  return (
    <Popover anchor={anchor} width={296} label="Icon" onClose={onClose}>
      <div className="notion-icon-grid">
        {ICONS.map((icon) => (
          <button key={icon} className="notion-icon-choice" aria-label={`Icon ${icon}`} onClick={() => setIcon(icon)}>{icon}</button>
        ))}
      </div>
      {page.icon && (
        <>
          <div className="db-menu-divider" />
          <button className="row w-full" onClick={() => setIcon('')}>Remove icon</button>
        </>
      )}
    </Popover>
  );
}

/** "Add icon" and "Add cover", shown on hover above the title like Notion. */
export function HeaderButtons({ page, onIcon, onCover }: { page: Page; onIcon: (anchor: Anchor) => void; onCover: (anchor: Anchor) => void }) {
  return (
    <div className="notion-header-buttons">
      {!page.icon && (
        <button className="notion-ghost" onClick={(event) => onIcon(anchorOf(event.currentTarget))}>
          <Smile size={15} strokeWidth={1.5} /> Add icon
        </button>
      )}
      {!page.cover && (
        <button className="notion-ghost" onClick={(event) => onCover(anchorOf(event.currentTarget))}>
          <Image size={15} strokeWidth={1.5} /> Add cover
        </button>
      )}
    </div>
  );
}
