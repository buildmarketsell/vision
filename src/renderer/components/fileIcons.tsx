import { File, FileCode, FileJson, FileText, Folder, FolderOpen, Image, Shapes, type LucideProps } from 'lucide-react';

const CODE = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'swift', 'kt', 'c', 'h', 'cpp', 'cs', 'php', 'sh', 'zsh', 'liquid', 'html', 'css', 'scss', 'vue', 'svelte', 'sql', 'yml', 'yaml', 'toml'];
const TEXT = ['md', 'mdx', 'txt', 'rtf', 'csv', 'log'];
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'heic', 'avif'];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function iconForFile(name: string, props: LucideProps) {
  const ext = extensionOf(name);
  if (ext === 'json') return <FileJson {...props} />;
  if (ext === 'excalidraw') return <Shapes {...props} />;
  if (CODE.includes(ext)) return <FileCode {...props} />;
  if (TEXT.includes(ext)) return <FileText {...props} />;
  if (IMAGE.includes(ext)) return <Image {...props} />;
  return <File {...props} />;
}

interface EntryIconProps {
  name: string;
  isDirectory?: boolean;
  isOpen?: boolean;
  size?: number;
}

/** The gray file or folder icon used in the tree and in tabs. */
export function EntryIcon({ name, isDirectory = false, isOpen = false, size = 16 }: EntryIconProps) {
  const props: LucideProps = { size, strokeWidth: 1.5, color: 'var(--color-text-muted)', 'aria-hidden': true };
  if (isDirectory) return isOpen ? <FolderOpen {...props} /> : <Folder {...props} />;
  return iconForFile(name, props);
}
