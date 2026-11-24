import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ModalProvider } from './context/Modal';
import { GoogleMapsProvider } from './context/GoogleMaps';
import { UnitsProvider } from './context/Units';
import { ToastProvider } from './context/Toast';
import App from './App';
import configureStore from './store';
import './index.css';

const store = configureStore();

// React 18+ API (ReactDOM.render was removed in React 19).
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <GoogleMapsProvider>
        <UnitsProvider>
          <ToastProvider>
            <ModalProvider>
              <App />
            </ModalProvider>
          </ToastProvider>
        </UnitsProvider>
      </GoogleMapsProvider>
    </Provider>
  </React.StrictMode>
);
