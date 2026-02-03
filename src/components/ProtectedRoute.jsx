import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase/config.js';

export default function ProtectedRoute({ children }) {
  const user = auth.currentUser;

  // 1. Si pas connecté du tout -> Login
  if (!user) return <Navigate to="/" />;

  // 2. Si connecté mais email non vérifié -> Page de vérification
  if (!user.emailVerified) return <Navigate to="/verif-email" />;

  // 3. Si tout est OK -> Accès au Dashboard
  return children;
}