import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDoc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  Truck, Phone, MapPin, Package, CheckCircle, XCircle, 
  LogOut, Clock, CheckCheck, Edit3, Trash2, Smartphone, User, Save, ChevronDown
} from 'lucide-react';

export default function LivreurDashboard() {
  const [activeTab, setActiveTab] = useState('attente'); 
  const [missions, setMissions] = useState([]);
  const [stockPeluches, setStockPeluches] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({ name: "", uid: "" });
  const [showPaymentModal, setShowPaymentModal] = useState(null); 
  const [editMode, setEditMode] = useState(null); 

  // 1. Profil du livreur connecté
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
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. Charger les peluches pour les menus et le calcul
  useEffect(() => {
    const fetchPeluches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "peluches"));
        const p = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStockPeluches(p);
      } catch (e) { console.error("Erreur chargement stock"); }
    };
    fetchPeluches();
  }, []);

  // 3. Écoute des commandes avec filtrage livreur_final pour "Terminé"
  useEffect(() => {
    setLoading(true);
    let statuts = (activeTab === 'attente') ? ["EN_ATTENTE"] : (activeTab === 'cours') ? ["EN_COURS"] : ["LIVRÉ"];
    const q = query(collection(db, "commandes"), where("statut_livraison", "in", statuts));

    const unsubscribe = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (activeTab === 'termine') {
        docs = docs.filter(m => m.livreur_final === m.livreur_nom && m.livreur_final === userProfile.name);
      }
      setMissions(docs);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab, userProfile.name]);

  // --- LOGIQUE DE STOCK ---

  const restaurerStock = async (nomArticle, quantite) => {
    try {
      const q = query(collection(db, "peluches"), where("nom", "==", nomArticle));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const pDoc = snap.docs[0];
        const nouveauStock = Number(pDoc.data().stock || 0) + Number(quantite);
        await updateDoc(doc(db, "peluches", pDoc.id), { stock: nouveauStock });
      }
    } catch (e) { console.error("Erreur stock retour:", e); }
  };

  // --- ACTIONS ---

  const modifierStatut = async (id, nouveauStatut) => {
    try {
      await updateDoc(doc(db, "commandes", id), {
        statut_livraison: nouveauStatut,
        livreur_nom: userProfile.name,
        derniere_maj: serverTimestamp()
      });
    } catch (e) { alert("Erreur réseau"); }
  };

  const handleAnnulerCommande = async (commande) => {
    if (window.confirm("Annuler et remettre la marchandise en stock ?")) {
      await restaurerStock(commande.nomArticle, commande.quantite);
      await updateDoc(doc(db, "commandes", commande.id), {
        statut_livraison: "ANNULÉ",
        derniere_maj: serverTimestamp()
      });
      alert("Annulé et stock mis à jour !");
    }
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

  const handleUpdateOrder = async (id, newQty, newArticleName) => {
    try {
      const peluche = stockPeluches.find(p => p.nom === newArticleName);
      const qty = Number(newQty);
      const nouveauPrix = peluche ? peluche.prix_vente * qty : 0;

      await updateDoc(doc(db, "commandes", id), {
        quantite: String(qty),
        nomArticle: newArticleName,
        prixTotal: nouveauPrix,
        modifie_par: userProfile.name,
        derniere_maj: serverTimestamp()
      });
      setEditMode(null);
    } catch (e) { alert("Erreur modif"); }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] font-['Inter'] pb-24">
      
      <header className="bg-[#1A1C23] text-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-40">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-orange-500">PELUCHE STORE</h1>
            <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest italic">Livreur : {userProfile.name}</p>
          </div>
          <button onClick={() => signOut(auth)} className="bg-white/10 p-3 rounded-2xl text-red-400"><LogOut size={20} /></button>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <TabBtn active={activeTab === 'attente'} onClick={() => setActiveTab('attente')} icon={<Clock size={16}/>} label="Attente" />
          <TabBtn active={activeTab === 'cours'} onClick={() => setActiveTab('cours')} icon={<Truck size={16}/>} label="En cours" />
          <TabBtn active={activeTab === 'termine'} onClick={() => setActiveTab('termine')} icon={<CheckCheck size={16}/>} label="Terminé" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 font-bold italic animate-pulse">Chargement des missions...</div>
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
                  {editMode === m.id ? (
                    <div className="relative mt-2">
                      <select id={`art-${m.id}`} defaultValue={m.nomArticle} className="appearance-none w-full bg-orange-50 border-b-2 border-orange-400 text-[11px] font-black uppercase px-2 py-2 rounded focus:outline-none">
                        {stockPeluches.map(p => (
                          <option key={p.id} value={p.nom}>{p.nom} ({p.taille}cm - {p.prix_vente}F)</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-2.5 text-orange-400 pointer-events-none" />
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tight">{m.nomArticle} — {m.prixTotal} F</p>
                  )}
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
                    {editMode === m.id ? (
                      <input type="number" id={`qty-${m.id}`} defaultValue={m.quantite} className="w-10 bg-white border border-orange-300 rounded text-center outline-none" />
                    ) : (
                      <span>Qté: {m.quantite}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {activeTab !== 'termine' && (
                  <a href={`tel:${m.tel}`} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95">
                    <Phone size={18} /> Appeler Client
                  </a>
                )}

                {activeTab === 'attente' && (
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleAnnulerCommande(m)} className="bg-red-50 text-red-500 p-4 rounded-2xl flex items-center justify-center active:scale-90"><Trash2 size={20}/></button>
                    {editMode === m.id ? (
                      <button onClick={() => handleUpdateOrder(m.id, document.getElementById(`qty-${m.id}`).value, document.getElementById(`art-${m.id}`).value)} className="bg-green-600 text-white p-4 rounded-2xl flex items-center justify-center shadow-lg"><Save size={20}/></button>
                    ) : (
                      <button onClick={() => setEditMode(m.id)} className="bg-gray-50 text-gray-400 p-4 rounded-2xl flex items-center justify-center"><Edit3 size={20}/></button>
                    )}
                    <button onClick={() => modifierStatut(m.id, "EN_COURS")} className="col-span-2 bg-[#4A3228] text-white font-black text-[10px] rounded-2xl uppercase tracking-widest shadow-lg">Lancer la course</button>
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
            <h2 className="text-2xl font-black text-[#4A3228] mb-8 uppercase tracking-tighter italic">Paiement</h2>
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