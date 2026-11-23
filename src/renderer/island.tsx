import { createRoot } from 'react-dom/client';
import { useAppTheme } from './core/appTheme';
import { useCustomColors } from './core/customColors';
import { Island } from '../features/focus/renderer/Island';
import '../features/focus/renderer/island.css';

// Dan's accent color, so the island's buttons match VISION.
useAppTheme.getState();
useCustomColors.getState();

const root = document.getElementById('root');
if (root) createRoot(root).render(<Island />);
