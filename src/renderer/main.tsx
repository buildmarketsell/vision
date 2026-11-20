import { createRoot } from 'react-dom/client';
import './styles.css';
import { features } from '../features/registry';
import { installFeatures } from './core/featureIndex';
import { useAppTheme } from './core/appTheme';
import { useCustomColors } from './core/customColors';
import { App } from './App';

// Applies the saved theme, then Dan's own colors on top, before the first paint.
useAppTheme.getState();
useCustomColors.getState();
installFeatures(features);

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
