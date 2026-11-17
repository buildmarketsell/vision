import { createRoot } from 'react-dom/client';
import './styles.css';
import { features } from '../features/registry';
import { installFeatures } from './core/featureIndex';
import { useAppTheme } from './core/appTheme';
import { App } from './App';

// Applies the saved theme before the first paint.
useAppTheme.getState();
installFeatures(features);

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
