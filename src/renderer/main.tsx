import { createRoot } from 'react-dom/client';
import './styles.css';
import { features } from '../features/registry';
import { installFeatures } from './core/featureIndex';
import { applyThemeVariables } from './theme';
import { App } from './App';

applyThemeVariables(document.documentElement);
installFeatures(features);

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
