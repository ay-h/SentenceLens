import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import { AppContext } from '@/store/AppContext';
import { useAppStore } from '@/store/useAppStore';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

function App() {
  const store = useAppStore();

  return (
    <AppContext.Provider value={store}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </HashRouter>
      <Toaster position="top-right" richColors closeButton />
    </AppContext.Provider>
  );
}

export default App
