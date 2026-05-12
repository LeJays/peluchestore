import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { auth, db } from '../firebase/config';
import { signInWithEmailAndPassword, signOut } from "firebase/auth"; // Ajout de signOut
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      
      // 1. Vérification de l'email
      if (!userCredential.user.emailVerified) {
        navigate('/verif-email');
        return;
      }

      // 2. Récupération du rôle dans Firestore
      const userDoc = await getDoc(doc(db, "utilisateurs", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // --- LA LOGIQUE DE ROUTE EST ICI ---
        if (userData.role === 'admin') {
          // Si c'est un Admin -> Direction le Dashboard complet
          navigate('/admin');
        } 
        else if (userData.role === 'livreur') {
          // Si c'est un Livreur -> Direction son espace mobile
          navigate('/livreur');
        } 
        else {
          // Rôle inconnu : par sécurité on déconnecte
          await signOut(auth);
          toast("Votre compte n'a pas de rôle assigné. Contactez l'administrateur.");
        }
      } else {
        toast("Profil introuvable dans la base de données.");
      }
    } catch (err) {
      // Gestion des erreurs en français pour le staff au Cameroun
      let message = "Erreur de connexion";
      if(err.code === 'auth/wrong-password') message = "Mot de passe incorrect";
      if(err.code === 'auth/user-not-found') message = "Cet email n'existe pas";
      toast(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F5F0] flex items-center justify-center p-4">
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        toastOptions={{
          duration: 5000,
          style: {
            background: '#4A3228',
            color: '#fff',
            padding: '24px 35px',
            borderRadius: '30px',
            fontSize: '16px',
            fontWeight: '900',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            maxWidth: '550px',
            border: '3px solid #A62626',
          },
        }}
      />
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border-b-8 border-[#A62626]">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-[#4A3228]">Peluche Store</h1>
          <p className="text-[#A62626] font-bold tracking-[0.2em] text-xs uppercase">Staff Portal Cameroon</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-[#4A3228] ml-2 uppercase">Email Professionnel</label>
            <input 
              type="email" 
              className="w-full mt-1 p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#A62626]/20 transition-all text-[#4A3228] font-medium" 
              placeholder="votre@email.com"
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#4A3228] ml-2 uppercase">Mot de Passe</label>
            <input 
              type="password" 
              className="w-full mt-1 p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#A62626]/20 transition-all text-[#4A3228] font-medium" 
              placeholder="••••••••"
              onChange={e => setPass(e.target.value)} 
              required 
            />
          </div>
          
          <button className="w-full bg-[#A62626] text-white p-5 rounded-2xl font-black text-lg hover:bg-[#4A3228] transition-all shadow-lg active:scale-95 uppercase tracking-widest">
            Se Connecter
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-gray-500 text-sm font-medium">
            Nouveau membre du staff ? 
            <Link to="/inscription" className="ml-2 text-[#A62626] font-black hover:underline uppercase text-xs">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}