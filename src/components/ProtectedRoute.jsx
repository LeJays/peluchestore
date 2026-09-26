import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebase/config.js';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Espace dédié à chaque rôle (évite les boucles de redirection)
const ESPACE_PAR_ROLE = {
  admin: '/admin',
  secretaire: '/secretaire',
  livreur: '/secretaire', // Compatibilité avec les anciens comptes "livreur"
};

export default function ProtectedRoute({ children, roleRequis }) {
  const [etat, setEtat] = useState({ chargement: true, connecte: false, emailVerifie: false, role: null });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEtat({ chargement: false, connecte: false, emailVerifie: false, role: null });
        return;
      }

      let role = null;
      try {
        const snap = await getDoc(doc(db, "utilisateurs", user.uid));
        if (snap.exists()) role = snap.data().role || null;
      } catch (error) {
        console.error("Erreur récupération du rôle :", error);
      }

      setEtat({ chargement: false, connecte: true, emailVerifie: user.emailVerified, role });
    });

    return () => unsubscribe();
  }, []);

  // 0. Chargement du profil : on attend avant de décider
  if (etat.chargement) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center gap-5">
        <div className="w-14 h-14 border-4 border-[#A62626] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#4A3228] text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Vérification des accès...</p>
      </div>
    );
  }

  // 1. Si pas connecté du tout -> Login
  if (!etat.connecte) return <Navigate to="/" />;

  // 2. Si connecté mais email non vérifié -> Page de vérification
  if (!etat.emailVerifie) return <Navigate to="/verif-email" />;

  // 3. Vérification du rôle demandé
  if (roleRequis) {
    const roleUtilisateur = etat.role === 'livreur' ? 'secretaire' : etat.role;

    if (roleUtilisateur !== roleRequis) {
      const destination = ESPACE_PAR_ROLE[etat.role];
      // Rôle inconnu : par sécurité on renvoie à la page de connexion
      return <Navigate to={destination || "/"} replace />;
    }
  }

  // 4. Si tout est OK -> Accès au Dashboard
  return children;
}