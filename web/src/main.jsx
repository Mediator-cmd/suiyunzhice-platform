import React from 'react';
import { createRoot } from 'react-dom/client';
// Leaflet 样式打进本地 bundle，不依赖 unpkg CDN —— 保证离线/内网/国内网络下都能正常渲染
import 'leaflet/dist/leaflet.css';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
