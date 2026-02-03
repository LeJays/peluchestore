import React, { useState } from 'react';
import { auth, db } from '../firebase/config.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [formData, setFormData] = useState({ nom: '', email: '', tel: '', pass: '', role: 'livreur' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Création du compte dans Auth
      const res = await createUserWithEmailAndPassword(auth, formData.email, formData.pass);
      
      // 2. Envoi de l'email de vérification (Ta demande explicite)
      await sendEmailVerification(res.user);

      // 3. Enregistrement des détails dans Firestore
      await setDoc(doc(db, "utilisateurs", res.user.uid), {
        nom: formData.nom,
        email: formData.email,
        telephone: formData.tel,
        role: formData.role,
        isVerified: false,
        createdAt: new Date()
      });

      alert("Compte créé ! Un email de vérification a été envoyé à " + formData.email);
      navigate('/'); // Retour au login
    } catch (err) {
      alert("Erreur : " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F9F5F0] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border-t-8 border-[#F2A7B5]">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-[#4A3228]">Nouveau Membre Staff</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Peluche Store Cameroon</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Nom complet" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F2A7B5]" 
            onChange={e => setFormData({...formData, nom: e.target.value})} required />
          
          <input type="email" placeholder="Email (Vérification requise)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F2A7B5]" 
            onChange={e => setFormData({...formData, email: e.target.value})} required />
          
          <input type="tel" placeholder="Téléphone (+237...)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F2A7B5]" 
            onChange={e => setFormData({...formData, tel: e.target.value})} required />
          
          <input type="password" placeholder="Mot de passe" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F2A7B5]" 
            onChange={e => setFormData({...formData, pass: e.target.value})} required />

          <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F2A7B5] font-bold text-[#4A3228]"
            onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="livreur">Livreur</option>
            <option value="admin">Administrateur</option>
          </select>
          
          <button disabled={loading} className="w-full bg-[#4A3228] text-white p-4 rounded-2xl font-bold text-lg hover:bg-[#A62626] transition-all shadow-lg active:scale-95">
            {loading ? "Création en cours..." : "Inscrire le membre"}
          </button>
        </form>
      </div>
    </div>
  );
}