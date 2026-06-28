import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { OrganizerPage } from './pages/OrganizerPage';
import { ViewerPage } from './pages/ViewerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthProvider>
              <OrganizerPage />
            </AuthProvider>
          }
        />
        <Route path="/t/:shareToken" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
