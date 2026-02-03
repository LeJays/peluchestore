import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import LivreurDashboard from './pages/LivreurDashboard.jsx'; // Ton nouveau composant
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

        {/* Page Livreur : Protégée + vérification rôle livreur */}
        <Route 
          path="/livreur" 
          element={
            <ProtectedRoute roleRequis="livreur">
              <LivreurDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;