import React from 'react';
import { auth } from '../firebase/config.js';
import { sendEmailVerification } from "firebase/auth";

export default function VerifyEmail() {
  const resend = () => {
    sendEmailVerification(auth.currentUser);
    alert("Nouveau lien envoyé ! Vérifie tes spams.");
  };

  return (
    <div className="min-h-screen bg-[#F9F5F0] flex items-center justify-center p-6 text-center">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm border-b-8 border-[#F2A7B5]">
        <div className="text-5xl mb-6">📩</div>
        <h2 className="text-2xl font-black text-[#4A3228] mb-4">Vérifie ton email</h2>
        <p className="text-gray-500 mb-8">
          Un lien a été envoyé à <b>{auth.currentUser?.email}</b>. 
          Clique dessus pour activer ton accès Peluche Store.
        </p>
        <button onClick={resend} className="text-[#A62626] font-bold underline">
          Renvoyer le lien
        </button>
        <br />
        <button onClick={() => window.location.reload()} className="mt-6 bg-[#4A3228] text-white px-8 py-3 rounded-xl font-bold">
          J'ai vérifié !
        </button>
      </div>
    </div>
  );
}