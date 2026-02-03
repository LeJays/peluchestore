import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, onSnapshot, query, where, orderBy, 
  updateDoc, doc, limit, deleteDoc, getDoc 
} from "firebase/firestore";
import { Trash2 } from 'lucide-react'; // Pour une icône sympa

export default function Livraisons() {
  const [commandesEnAttente, setCommandesEnAttente] = useState([]);
  const [historiqueLivraisons, setHistoriqueLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);

  // FONCTION POUR ÉVITER L'ERREUR {seconds, nanoseconds}
  const formatDate = (dateField) => {
    if (!dateField) return "N/A";
    if (dateField.seconds) {
      return new Date(dateField.seconds * 1000).toLocaleString('fr-FR');
    }
    return String(dateField);
  };

  useEffect(() => {
    const qAttente = query(
      collection(db, "commandes"),
      where("statut_livraison", "in", ["EN_ATTENTE", "EN_COURS"]),
      orderBy("timestamp", "desc")
    );

    const qLivre = query(
      collection(db, "commandes"),
      where("statut_livraison", "==", "LIVRÉ"),
      orderBy("date_livraison_reelle", "desc"),
      limit(50)
    );

    const unsubAttente = onSnapshot(qAttente, (snap) => {
      setCommandesEnAttente(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubLivre = onSnapshot(qLivre, (snap) => {
      setHistoriqueLivraisons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAttente(); unsubLivre(); };
  }, []);

  // NOUVELLE FONCTION : ANNULER ET REMETTRE EN STOCK
  const annulerCommande = async (commande) => {
    const confirmation = window.confirm(`Voulez-vous annuler la commande de ${commande.client} ? Le stock de la peluche sera augmenté de ${commande.quantite}.`);
    
    if (!confirmation) return;

    try {
      // 1. Récupérer la peluche pour mettre à jour son stock
      if (commande.pelucheId) {
        const pelucheRef = doc(db, "peluches", commande.pelucheId);
        const pelucheSnap = await getDoc(pelucheRef);

        if (pelucheSnap.exists()) {
          const stockActuel = Number(pelucheSnap.data().stock || 0);
          await updateDoc(pelucheRef, {
            stock: stockActuel + Number(commande.quantite)
          });
        }
      }

      // 2. Supprimer la commande
      await deleteDoc(doc(db, "commandes", commande.id));
      
      alert("Commande supprimée et stock rétabli !");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'annulation : " + err.message);
    }
  };

  const validerLivraison = async (commande) => {
    if (!window.confirm(`Confirmer la livraison de ${commande.client} ?`)) return;
    try {
      const updates = {
        statut_livraison: 'LIVRÉ',
        date_livraison_reelle: new Date().toLocaleString('fr-FR'),
        livreur_final: commande.livreur_nom || "Admin" 
      };

      if (commande.statut === 'payé' || commande.statut_paiement === 'TOTALEMENT_PAYÉ') {
        updates.statut_paiement = 'TOTALEMENT_PAYÉ';
      }

      await updateDoc(doc(db, "commandes", commande.id), updates);
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  };

  return (
    <div className="space-y-10 p-4 max-w-7xl mx-auto font-['Inter']">
      
      {/* HEADER */}
      <div className="bg-[#1A1C23] p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl border-b-4 border-orange-600">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Logistique & Flux</h2>
          <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em]">Suivi des livraisons Cameroun 🇨🇲</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center min-w-[100px]">
          <span className="block text-2xl font-black text-orange-500">{commandesEnAttente.length}</span>
          <span className="text-[7px] uppercase font-bold opacity-50 tracking-widest">En cours</span>
        </div>
      </div>

      {/* MISSIONS ACTIVES */}
      <section>
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
          <h3 className="text-xl font-black text-[#4A3228] uppercase italic">Colis à livrer</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {commandesEnAttente.map((c) => (
            <div key={c.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase italic bg-orange-50 text-orange-600 border border-orange-100">
                  {c.statut_livraison}
                </span>
                {/* BOUTON ANNULER RAPIDE */}
                <button 
                  onClick={() => annulerCommande(c)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Annuler la commande"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="mb-6 flex-grow">
                <h4 className="text-lg font-black text-[#4A3228] uppercase leading-tight">{c.nomArticle}</h4>
                <p className="text-[10px] font-bold text-gray-400 mt-2">DATE COMMANDE : {formatDate(c.timestamp || c.date)}</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                 <p className="text-[11px] font-black text-[#4A3228] uppercase">{c.client}</p>
                 <p className="text-[10px] font-bold text-blue-600 mt-1">{c.tel}</p>
                 <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">📍 {c.lieu}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => validerLivraison(c)}
                  className="w-full bg-[#1A1C23] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-green-600 shadow-lg active:scale-95 transition-all"
                >
                  Confirmer Livraison
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TABLEAU HISTORIQUE */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-gray-50 overflow-hidden">
        <h3 className="text-xl font-black text-[#4A3228] uppercase italic mb-8">Historique des Livraisons</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                <th className="pb-4 px-2">Date / Heure</th>
                <th className="pb-4 px-2">Client</th>
                <th className="pb-4 px-2">Article</th>
                <th className="pb-4 px-2 text-center">Fait par</th>
                <th className="pb-4 px-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historiqueLivraisons.map((h) => (
                <tr key={h.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 text-[10px] font-bold text-gray-400">
                    {formatDate(h.date_livraison_reelle)}
                  </td>
                  <td className="py-5 px-2 font-black text-[#4A3228] text-xs uppercase">{h.client}</td>
                  <td className="py-5 px-2 text-[10px] font-bold text-gray-600 uppercase">
                    {h.nomArticle} <span className="text-orange-500 ml-1">x{h.quantite}</span>
                  </td>
                  <td className="py-5 px-2 text-center">
                    <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider group-hover:bg-[#1A1C23] group-hover:text-white transition-all">
                      {h.livreur_final || "Admin"}
                    </span>
                  </td>
                  <td className="py-5 px-2 text-right font-black text-[#A62626] text-xs italic">
                    {Number(h.prixTotal).toLocaleString()} F
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}