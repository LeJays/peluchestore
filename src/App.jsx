import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import SecretaireDashboard from './pages/SecretaireDashboard.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Router>
      <Routes>
        {/* Pages Publiques */}
        <Route path="/" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/verif-email" element={<VerifyEmail />} />
        
        {/* Page Admin : Protégée + vérification rôle admin */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute roleRequis="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Page Secrétaire : Protégée + vérification rôle secretaire */}
        <Route 
          path="/secretaire" 
          element={
            <ProtectedRoute roleRequis="secretaire">
              <SecretaireDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Ancienne route Livreur : redirection vers l'espace secrétariat */}
        <Route path="/livreur" element={<Navigate to="/secretaire" replace />} />
      </Routes>
    </Router>
  );
}

export default App;