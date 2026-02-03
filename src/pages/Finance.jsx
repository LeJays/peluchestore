import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";

export default function Finance() {
  const [commandes, setCommandes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [peluches, setPeluches] = useState([]); // Pour la valeur du stock
  const [capital, setCapital] = useState(0);
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [nouveauCapital, setNouveauCapital] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubCapital = onSnapshot(doc(db, "settings", "finance"), (doc) => {
      if (doc.exists()) {
        setCapital(doc.data().capital || 0);
        setNouveauCapital(doc.data().capital || 0);
      }
    });

    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      setCommandes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubDepenses = onSnapshot(collection(db, "depenses"), (snap) => {
      setDepenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPeluches = onSnapshot(collection(db, "peluches"), (snap) => {
      setPeluches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubCapital(); unsubCommandes(); unsubDepenses(); unsubPeluches(); };
  }, []);

  const handleUpdateCapital = async () => {
    try {
      await setDoc(doc(db, "settings", "finance"), { capital: Number(nouveauCapital) }, { merge: true });
      setIsEditingCapital(false);
    } catch (err) { alert(err.message); }
  };

  // --- CALCULS ---
  const totalVentes = commandes.reduce((acc, curr) => {
    let montantEncaisse = 0;
    if (curr.statut === 'payé' && curr.statut_paiement === 'TOTALEMENT_PAYÉ') {
      montantEncaisse = Number(curr.prixTotal);
    } else if (curr.statut === 'prépayé') {
      montantEncaisse = Number(curr.montantRembourse) || 0;
    }
    return acc + montantEncaisse;
  }, 0);

  const totalDettes = commandes.reduce((acc, curr) => {
    if (curr.statut === "prépayé" && curr.statut_paiement !== "TOTALEMENT_PAYÉ") {
      const reste = curr.resteAPayer !== undefined ? Number(curr.resteAPayer) : Number(curr.prixTotal);
      return acc + reste;
    }
    return acc;
  }, 0);

  const totalDepenses = depenses.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);
  
  // NOUVEAUX CALCULS
  const totalEnCaisse = totalVentes - capital - totalDepenses;
  const valeurStock = peluches.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.prix_vente || 0)), 0);

  const enregistrerRemboursement = async (commande) => {
    const montant = prompt(`Somme versée par ${commande.client} ? (Dû: ${commande.resteAPayer || commande.prixTotal} F)`);
    if (!montant || isNaN(montant)) return;
    const resteActuel = commande.resteAPayer !== undefined ? Number(commande.resteAPayer) : Number(commande.prixTotal);
    const nouveauReste = resteActuel - Number(montant);
    const nouveauCumul = (Number(commande.montantRembourse) || 0) + Number(montant);
    await updateDoc(doc(db, "commandes", commande.id), {
      resteAPayer: nouveauReste,
      montantRembourse: nouveauCumul,
      statut_paiement: nouveauReste <= 0 ? "TOTALEMENT_PAYÉ" : "PARTIELLEMENT_PAYÉ"
    });
  };

  if (loading) return <div className="p-20 text-center font-black text-[#4A3228]">CHARGEMENT...</div>;

  return (
    <div className="space-y-8 pb-20">
      {/* GRILLE DES CARTES PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#4A3228] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-4">💰 Total en Caisse</p>
          <h3 className={`text-4xl font-black ${totalEnCaisse >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalEnCaisse.toLocaleString()} F
          </h3>
          <p className="text-[9px] mt-2 opacity-60 font-bold italic">(Ventes - Capital - Dépenses)</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">🧸 Valeur du Stock</p>
          <h3 className="text-4xl font-black text-[#4A3228]">{valeurStock.toLocaleString()} F</h3>
          <div className="absolute right-[-10px] bottom-[-10px] text-gray-50 text-7xl"><i className="fa-solid fa-box-open"></i></div>
        </div>

        <div className="bg-[#A62626] p-8 rounded-[2.5rem] text-white shadow-xl">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-4">📉 Total Dépenses</p>
          <h3 className="text-4xl font-black">{totalDepenses.toLocaleString()} F</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* CAPITAL MODIFIABLE */}
        <div className="bg-gray-100 p-6 rounded-[2rem] border">
          <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Capital Investi</p>
          {isEditingCapital ? (
            <div className="flex gap-1">
              <input type="number" className="w-full bg-white rounded-lg px-2 py-1 text-xs font-bold outline-none border" value={nouveauCapital} onChange={(e) => setNouveauCapital(e.target.value)} />
              <button onClick={handleUpdateCapital} className="bg-green-600 text-white px-2 rounded-lg text-[8px] font-black uppercase">OK</button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="font-black text-[#4A3228]">{capital.toLocaleString()} F</span>
              <button onClick={() => setIsEditingCapital(true)} className="text-[8px] font-black underline opacity-40">Modifier</button>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Ventes Réelles</p>
          <p className="text-xl font-black text-green-600">{totalVentes.toLocaleString()} F</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Dettes Dehors</p>
          <p className="text-xl font-black text-red-500">{totalDettes.toLocaleString()} F</p>
        </div>
      </div>

      {/* GRAPHE MODES DE PAIEMENT */}
      <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Répartition des paiements encaissés</h3>
        <div className="space-y-6">
          {['Orange Money', 'Mobile Money', 'Cash'].map(mode => {
            const montantMode = commandes
              .filter(c => c.paiement === mode && (c.statut_paiement === 'TOTALEMENT_PAYÉ' || c.montantRembourse > 0))
              .reduce((acc, curr) => {
                const encaisse = curr.statut === 'payé' ? Number(curr.prixTotal) : Number(curr.montantRembourse);
                return acc + encaisse;
              }, 0);
            const pourcentage = totalVentes > 0 ? (montantMode / totalVentes) * 100 : 0;

            return (
              <div key={mode} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-[#4A3228] uppercase">{mode}</span>
                  <span className="text-xs font-black text-gray-400">{montantMode.toLocaleString()} F <span className="ml-2 text-[10px] text-[#A62626]">{pourcentage.toFixed(0)}%</span></span>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden border border-gray-50">
                  <div 
                    className={`h-full transition-all duration-1000 ${mode === 'Orange Money' ? 'bg-orange-500' : mode === 'Mobile Money' ? 'bg-yellow-400' : 'bg-green-600'}`} 
                    style={{ width: `${pourcentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TABLEAU DES DETTES CLIENTS */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-8 bg-red-50 border-b flex justify-between items-center">
          <h3 className="font-black text-[#A62626] uppercase text-xs tracking-widest">📋 Suivi des impayés</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
            <tr><th className="p-6">Client</th><th className="p-6">Reste à Payer</th><th className="p-6 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commandes.filter(c => c.statut === "prépayé" && c.statut_paiement !== "TOTALEMENT_PAYÉ").map(c => (
              <tr key={c.id} className="text-xs hover:bg-gray-50">
                <td className="p-6 font-bold text-[#4A3228]">{c.client} <br/><span className="text-[9px] text-gray-400">{c.tel}</span></td>
                <td className="p-6 font-black text-red-600">{(c.resteAPayer ?? c.prixTotal).toLocaleString()} F</td>
                <td className="p-6 text-right">
                  <button onClick={() => enregistrerRemboursement(c)} className="bg-[#4A3228] text-white px-6 py-3 rounded-2xl font-black text-[9px] uppercase hover:bg-[#A62626] transition-all shadow-md">Encaisser</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}