import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { 
  collection, onSnapshot, query, where, doc, updateDoc, 
  serverTimestamp, getDoc, deleteDoc 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth"; // Import de signOut
import { 
  Truck, Phone, MapPin, Package, CheckCircle, 
  LogOut, Clock, CheckCheck, Trash2, Smartphone, User, MessageCircle
} from 'lucide-react';

export default function LivreurDashboard() {
  const [activeTab, setActiveTab] = useState('attente'); 
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({ name: "", uid: "" });
  const [showPaymentModal, setShowPaymentModal] = useState(null); 

  // 1. Profil et Gestion de la session
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const d = await getDoc(doc(db, "utilisateurs", user.uid));
          setUserProfile({ 
            name: d.data()?.name || d.data()?.nom || user.email.split('@')[0],
            uid: user.uid 
          });
        } catch (error) {
          setUserProfile({ name: user.email.split('@')[0], uid: user.uid });
        }
      } else {
        // Optionnel: Redirection vers login si nécessaire ici
        // window.location.href = "/login"; 
      }
    });
    return () => unsubAuth();
    }, []);
  // 2. Écoute des commandes
  useEffect(() => {
    setLoading(true);
    let statuts = (activeTab === 'attente') ? ["EN_ATTENTE"] : (activeTab === 'cours') ? ["EN_COURS"] : ["LIVRÉ"];
    const q = query(collection(db, "commandes"), where("statut_livraison", "in", statuts));

    const unsubscribe = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (activeTab === 'termine') {
        docs = docs.filter(m => m.livreur_final === userProfile.name);
      }
      setMissions(docs);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab, userProfile.name]);

  // --- FONCTION DE DECONNEXION ---
  const handleLogout = async () => {
    if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) {
      try {
        await signOut(auth);
      } catch (error) {
        alert("Erreur lors de la déconnexion");
      }
    }
  };

  const handleAnnulerCommande = async (commande) => {
    const confirmation = window.confirm(
      `Supprimer la commande de ${commande.client} ? \nLe stock sera remis à jour (+${commande.quantite}).`
    );
    if (!confirmation) return;
    try {
      if (commande.pelucheId) {
        const pelucheRef = doc(db, "peluches", commande.pelucheId);
        const pelucheSnap = await getDoc(pelucheRef);
        if (pelucheSnap.exists()) {
          await updateDoc(pelucheRef, {
            stock: Number(pelucheSnap.data().stock || 0) + Number(commande.quantite)
          });
        }
      }
      await deleteDoc(doc(db, "commandes", commande.id));
    } catch (err) { alert("Erreur : " + err.message); }
  };

  const modifierStatut = async (id, nouveauStatut) => {
    try {
      await updateDoc(doc(db, "commandes", id), {
        statut_livraison: nouveauStatut,
        livreur_nom: userProfile.name,
        derniere_maj: serverTimestamp()
      });
    } catch (e) { alert("Erreur réseau"); }
  };

  const finaliserLivraison = async (modePaiement) => {
    if (!showPaymentModal) return;
    try {
      await updateDoc(doc(db, "commandes", showPaymentModal), {
        statut_livraison: "LIVRÉ",
        statut: "payé",
        statut_paiement: "TOTALEMENT_PAYÉ", 
        paiement: modePaiement,
        livreur_final: userProfile.name,
        date_livraison_reelle: serverTimestamp()
      });
      setShowPaymentModal(null);
    } catch (e) { alert("Erreur validation"); }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] font-['Inter'] pb-24">
      <header className="bg-[#1A1C23] text-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-40">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-orange-500 uppercase">Peluche Store 🇨🇲</h1>
            <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest italic">Livreur : {userProfile.name}</p>
          </div>
          {/* BOUTON DECONNEXION FONCTIONNEL ICI */}
          <button 
            onClick={handleLogout} 
            className="bg-white/10 p-3 rounded-2xl text-red-400 active:scale-90 transition-transform"
          >
            <LogOut size={20} />
          </button>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <TabBtn active={activeTab === 'attente'} onClick={() => setActiveTab('attente')} icon={<Clock size={16}/>} label="Attente" />
          <TabBtn active={activeTab === 'cours'} onClick={() => setActiveTab('cours')} icon={<Truck size={16}/>} label="En cours" />
          <TabBtn active={activeTab === 'termine'} onClick={() => setActiveTab('termine')} icon={<CheckCheck size={16}/>} label="Terminé" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 font-bold italic animate-pulse">Chargement...</div>
        ) : missions.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <Package size={50} className="mx-auto mb-2 text-gray-400" />
            <p className="font-black text-xs uppercase text-gray-400 tracking-widest">Aucun colis</p>
          </div>
        ) : (
          missions.map((m) => (
            <div key={m.id} className="bg-white rounded-[2.5rem] p-6 shadow-md border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                  <User size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-[#4A3228] capitalize leading-none">{m.client}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tight">
                    {m.nomArticle} — <span className="text-orange-600">{Number(m.prixTotal).toLocaleString()} F</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-2">
                  <MapPin size={14} className="text-[#A62626]" />
                  <span className="text-xs font-black text-[#A62626] uppercase italic">{m.lieu}</span>
                </div>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-blue-600 font-black"><Phone size={14} /> <span className="text-sm">{m.tel}</span></div>
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-black text-gray-600">
                    <Package size={12}/>
                    <span>Qté: {m.quantite}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {activeTab !== 'termine' && (
                  <div className="grid grid-cols-2 gap-3">
                    
                    {/* Bouton appel normal */}
                    <a 
                      href={`tel:${m.tel}`} 
                      className="flex items-center justify-center gap-3 bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95"
                    >
                      <Phone size={18} /> Appeler
                    </a>

                    {/* Bouton WhatsApp */}
                    <a 
                      href={`https://wa.me/237${m.tel.replace(/\D/g, '').slice(-9)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 bg-green-500 text-white p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95"
                    >
                      <MessageCircle size={18} /> WhatsApp
                    </a>

                  </div>
                )}


                {activeTab === 'attente' && (
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleAnnulerCommande(m)} className="bg-red-50 text-red-500 p-4 rounded-2xl flex items-center justify-center active:scale-90 border border-red-100"><Trash2 size={20}/></button>
                    <button onClick={() => modifierStatut(m.id, "EN_COURS")} className="col-span-3 bg-[#4A3228] text-white font-black text-[10px] rounded-2xl uppercase tracking-widest shadow-lg">Lancer la course</button>
                  </div>
                )}

                {activeTab === 'cours' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => modifierStatut(m.id, "EN_ATTENTE")} className="bg-gray-100 text-gray-400 p-4 rounded-2xl font-black text-[10px] uppercase text-center italic border border-gray-200">Reporter</button>
                    <button onClick={() => setShowPaymentModal(m.id)} className="bg-[#10B981] text-white p-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95"><CheckCircle size={20}/> Encaisser</button>
                  </div>
                )}

                {activeTab === 'termine' && (
                  <div className="flex items-center justify-between bg-green-50 p-4 rounded-2xl border border-green-100">
                    <span className="text-[10px] font-black text-green-600 uppercase italic">Payé par {m.paiement}</span>
                    <CheckCheck size={20} className="text-green-500" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-[#1A1C23]/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-[#4A3228] mb-8 uppercase tracking-tighter italic border-b pb-4">Mode de Paiement</h2>
            <div className="grid grid-cols-1 gap-3">
              <PaymentBtn color="bg-[#FF6600]" label="Orange Money" onClick={() => finaliserLivraison("Orange Money")} />
              <PaymentBtn color="bg-[#FFCC00]" label="Mobile Money" onClick={() => finaliserLivraison("Mobile Money")} />
              <PaymentBtn color="bg-[#10B981]" label="Cash / Espèces" onClick={() => finaliserLivraison("Cash")} />
              <button onClick={() => setShowPaymentModal(null)} className="mt-6 text-gray-400 text-[10px] font-black uppercase">Retour</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center py-4 gap-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-[#A62626] text-white shadow-xl scale-105 font-black' : 'text-gray-500'}`}>
      {icon} <span className="text-[8px] uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function PaymentBtn({ color, label, onClick }) {
  return (
    <button onClick={onClick} className={`${color} text-white p-5 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-3 active:scale-95 transition-all shadow-md`}>
      <Smartphone size={18} /> {label}
    </button>
  );
}