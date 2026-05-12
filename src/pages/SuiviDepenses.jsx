import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PlusCircle, History, Wallet, TrendingDown, Pencil, Check, X, Trash2 } from 'lucide-react';

export default function SuiviDepenses() {
  const currentMonth = new Date().toISOString().slice(0,7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);
  const [allDepenses, setAllDepenses] = useState([]);
  const [allDepensesReliquat, setAllDepensesReliquat] = useState([]);
  const [allCommandes, setAllCommandes] = useState([]);
  const [nomUtilisateur, setNomUtilisateur] = useState('Admin');
  const [loading, setLoading] = useState(true);
  
  // Formulaire pour dépense sur reliquat
  const [formReliquat, setFormReliquat] = useState({ mois: '', type: '', montant: '' });
  const [editIdReliquat, setEditIdReliquat] = useState(null);
  const [editFormReliquat, setEditFormReliquat] = useState({ type: '', montant: '' });

  useEffect(() => {
    const getConnectedUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "utilisateurs", user.uid));
          if (userDoc.exists()) setNomUtilisateur(userDoc.data().nom || userDoc.data().name);
        } catch (e) { setNomUtilisateur("Admin"); }
      }
    };
    getConnectedUserName();
  }, []);

  useEffect(() => {
    const unsubDeps = onSnapshot(collection(db, 'depenses'), snap => {
      setAllDepenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubDepsReliquat = onSnapshot(collection(db, 'depenses_reliquat'), snap => {
      setAllDepensesReliquat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCmds = onSnapshot(collection(db, 'commandes'), snap => {
      setAllCommandes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubDeps(); unsubDepsReliquat(); unsubCmds(); };
  }, []);

  // --- LOGIQUE DE CALCUL DU BUDGET (PARTAGÉE AVEC REPARTITION) ---
  const calculateBudgetForMonth = (monthStr, commands, expenses) => {
    const [year, month] = monthStr.split("-").map(Number);
    const debut = new Date(year, month - 1, 1);
    const fin = new Date(year, month, 0, 23, 59, 59);

    const sales = commands.filter(c => {
      let d = null;
      if (c.timestamp?.toDate) d = c.timestamp.toDate();
      else if (c.dateJS?.seconds) d = new Date(c.dateJS.seconds * 1000);
      else if (c.timestamp instanceof Date) d = c.timestamp;
      
      return d && d >= debut && d <= fin;
    }).reduce((acc, v) => {
      let montant = 0;
      // On harmonise avec la logique des autres pages pour le calcul du CA
      if ((v.statut === "payé" && v.statut_paiement === "TOTALEMENT_PAYÉ") || v.statut_paiement === "ATTENTE_LIVRAISON") {
        montant = Number(v.prixTotal) || 0;
      } else if (v.statut === "prépayé") {
        montant = Number(v.montantRembourse) || 0;
      }
      return acc + montant;
    }, 0);

    const categoriesDef = [
      { name: "Loyer", part: 0.4 * 0.3 },
      { name: "Connexion", part: 0.4 * 0.1 },
      { name: "Salaire", part: 0.4 * 0.3 },
      { name: "Électricité", part: 0.4 * 0.15 },
      { name: "Autre", part: 0.4 * 0.15 },
      { name: "Cotisation", part: 0.3 },
      { name: "Achat peluche", part: 0.3 * 0.4 },
      { name: "Achat coton", part: 0.3 * 0.2 },
      { name: "Transport", part: 0.3 * 0.4 },
    ];

  const plafonds = {
    "Loyer": 50000,
    "Connexion": 20000,
    "Salaire": 100000,
    "Électricité": 15000,
    "Autre": 30000
  };

    let surplus = 0;
    categoriesDef.slice(0, 5).forEach(c => {
      const montantBrut = sales * c.part;
      const plafond = plafonds[c.name];
      if (montantBrut > plafond) surplus += (montantBrut - plafond);
    });

    const restockageNames = ["Achat peluche", "Achat coton", "Transport"];
    const surplusParCategorie = surplus / restockageNames.length;

    return categoriesDef.map(c => {
      let montantAutorise = sales * c.part;
      if (plafonds[c.name] !== undefined) {
        montantAutorise = Math.min(montantAutorise, plafonds[c.name]);
      }
      if (restockageNames.includes(c.name)) {
        montantAutorise += surplusParCategorie;
      }

      const dejaDepense = expenses.filter(d => {
        const ts = d.timestamp?.toDate?.();
        return ts && ts >= debut && ts <= fin && d.type === c.name;
      }).reduce((acc, d) => acc + Number(d.montant || 0), 0);

      return {
        name: c.name,
        montantAutorise,
        dejaDepense,
        reste: Math.max(montantAutorise - dejaDepense, 0)
      };
    });
  };

  const currentBudget = useMemo(() => calculateBudgetForMonth(moisSelectionne, allCommandes, allDepenses), [moisSelectionne, allCommandes, allDepenses]);

  // --- CALCUL DU RELIQUAT CUMULÉ PAR CATÉGORIE ---
  const aggregatedRestes = useMemo(() => {
    const totals = {};
    const categories = ["Loyer", "Connexion", "Salaire", "Électricité", "Autre", "Cotisation", "Achat peluche", "Achat coton", "Transport"];
    categories.forEach(cat => totals[cat] = 0);

    // 1. Somme des restes "naturels" des 12 derniers mois
    let d = new Date();
    d.setMonth(d.getMonth() - 1); 
    for (let i = 0; i < 12; i++) {
      const mStr = d.toISOString().slice(0, 7);
      const budget = calculateBudgetForMonth(mStr, allCommandes, allDepenses);
      budget.forEach(b => {
        totals[b.name] += b.reste;
      });
      d.setMonth(d.getMonth() - 1);
    }

    // 2. Soustraire TOUTES les dépenses déjà enregistrées dans la collection dédiée
    allDepensesReliquat.forEach(dep => {
      if (totals[dep.type] !== undefined) {
        totals[dep.type] -= Number(dep.montant || 0);
      }
    });

    return totals;
  }, [allCommandes, allDepenses, allDepensesReliquat]);

  const historyRestes = useMemo(() => {
    const months = [];
    let d = new Date();
    d.setMonth(d.getMonth() - 1); 
    
    for (let i = 0; i < 12; i++) {
      const mStr = d.toISOString().slice(0, 7);
      const budget = calculateBudgetForMonth(mStr, allCommandes, allDepenses);
      const hasReste = budget.some(b => b.reste > 10);
      if (hasReste) {
        months.push({ mois: mStr, budget });
      }
      d.setMonth(d.getMonth() - 1);
    }
    return months;
  }, [allCommandes, allDepenses]);

  const handleAjouterSurReliquat = async (e) => {
    e.preventDefault();
    const { type, montant } = formReliquat;
    if (!type || !montant) return;

    const disponible = aggregatedRestes[type] || 0;
    
    if (disponible < Number(montant)) {
      toast(`Impossible : Reliquat global insuffisant pour ${type}.\nDisponible : ${disponible.toLocaleString()} F`);
      return;
    }

    try {
      await addDoc(collection(db, "depenses_reliquat"), {
        type,
        montant: Number(montant),
        faitPar: nomUtilisateur,
        date: new Date().toLocaleDateString('fr-FR'),
        timestamp: new Date(),
        description: "Dépense sur reliquat cumulé"
      });

      toast("Dépense enregistrée sur le reliquat cumulé !");
      setFormReliquat({ mois: '', type: '', montant: '' });
    } catch (err) {
      toast(err.message);
    }
  };

  const startEditReliquat = (d) => {
    setEditIdReliquat(d.id);
    setEditFormReliquat({ type: d.type, montant: d.montant });
  };

  const saveEditReliquat = async (id) => {
    try {
      await updateDoc(doc(db, "depenses_reliquat", id), {
        type: editFormReliquat.type,
        montant: Number(editFormReliquat.montant)
      });
      setEditIdReliquat(null);
      toast("Dépense modifiée !");
    } catch (err) { 
      toast(err.message); 
    }
  };

  const handleDeleteReliquat = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette dépense ? L'argent reviendra à la cagnotte.")) {
      try {
        await deleteDoc(doc(db, "depenses_reliquat", id));
        toast("Dépense supprimée ! L'argent a été remboursé à la cagnotte.");
      } catch (err) { 
        toast("Erreur lors de la suppression : " + err.message); 
      }
    }
  };

  if (loading) return <div className="p-20 text-center font-black">CHARGEMENT DES DONNÉES...</div>;

  return (
    <div className="space-y-10 pb-20 font-sans">
      {/* HEADER STATS */}
      <div className="bg-[#4A3228] p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
             <History size={24} className="text-orange-400" />
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Suivi des Reliquats</h2>
          </div>
          <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
            GESTION DES FONDS NON CONSOMMÉS
          </p>
        </div>
        <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-right">
          <span className="text-[10px] font-black opacity-50 uppercase block mb-1">Total Reliquats Cumulés</span>
          <span className="text-3xl font-black text-orange-400">
            {Object.values(aggregatedRestes).reduce((a, b) => a + b, 0).toLocaleString()} F
          </span>
        </div>
      </div>

      {/* SECTION MOIS SELECTIONNE */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
             <label className="font-black text-[#4A3228] uppercase text-[10px] tracking-widest">Période :</label>
             <input 
                type="month" 
                value={moisSelectionne} 
                onChange={(e) => setMoisSelectionne(e.target.value)} 
                className="bg-gray-50 border-none rounded-xl p-3 font-bold text-[#4A3228] cursor-pointer" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                <th className="p-5">Catégorie</th>
                <th className="p-5">Budget Autorisé</th>
                <th className="p-5">Dépensé</th>
                <th className="p-5 text-right">Reliquat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentBudget.map((cat, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-5 font-black text-[#4A3228] uppercase text-xs">{cat.name}</td>
                  <td className="p-5 font-bold text-gray-500">{cat.montantAutorise.toLocaleString()} F</td>
                  <td className="p-5 font-bold text-red-400">{cat.dejaDepense.toLocaleString()} F</td>
                  <td className="p-5 text-right font-black text-green-600 text-sm">
                    {cat.reste.toLocaleString()} F
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION HISTORIQUE & FORMULAIRE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
           <form onSubmit={handleAjouterSurReliquat} className="bg-[#1A1C23] p-8 rounded-[3rem] shadow-xl text-white sticky top-5">
              <div className="flex items-center gap-2 mb-6">
                <PlusCircle size={20} className="text-orange-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest">Dépense sur Cagnotte (Reliquat)</h3>
              </div>
              <div className="space-y-4">
                 <select value={formReliquat.type} onChange={e => setFormReliquat({...formReliquat, type: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold outline-none focus:border-orange-400" required>
                    <option value="" className="text-black">-- Choisir Catégorie --</option>
                    {Object.entries(aggregatedRestes).filter(([_, val]) => val > 0).map(([name, val]) => (
                      <option key={name} value={name} className="text-black">{name.toUpperCase()} ({val.toLocaleString()} F)</option>
                    ))}
                 </select>
                 <input type="number" placeholder="Montant (FCFA)" value={formReliquat.montant} onChange={e => setFormReliquat({...formReliquat, montant: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold outline-none focus:border-orange-400" required />
                 <button className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-orange-600 transition-all">Payer avec la cagnotte</button>
              </div>
           </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-2 px-4">
             <Wallet size={18} className="text-green-600" />
             <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Cagnottes disponibles (Cumul des reliquats)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {Object.entries(aggregatedRestes).map(([cat, val]) => (
               <div key={cat} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{cat}</p>
                    <p className={`text-xl font-black ${val > 0 ? 'text-green-600' : 'text-gray-300'}`}>{val.toLocaleString()} F</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${val > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
                    <TrendingDown size={18} />
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* GRAPH DE RÉPARTITION ACTUEL */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
           <TrendingDown size={18} className="text-green-600" />
           <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Situation du budget {moisSelectionne} (Hors Reliquats)</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentBudget.map(t => ({ name: t.name, reste: t.reste }))}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={9} />
              <YAxis axisLine={false} tickLine={false} fontSize={10} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="reste" fill="#10B981" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLEAU HISTORIQUE DES DÉPENSES SUR RELIQUAT */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
           <History size={18} className="text-orange-400" />
           <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Historique des dépenses sur reliquat</h3>
        </div>
        {allDepensesReliquat.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Aucune dépense enregistrée sur reliquat</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                  <th className="p-5">Date</th>
                  <th className="p-5">Catégorie</th>
                  <th className="p-5">Montant</th>
                  <th className="p-5">Effectué par</th>
                  <th className="p-5">Description</th>
                  <th className="p-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...allDepensesReliquat].sort((a, b) => {
                  const tsA = a.timestamp?.toDate?.() || new Date(a.date);
                  const tsB = b.timestamp?.toDate?.() || new Date(b.date);
                  return tsB - tsA;
                }).map((dep) => (
                  <tr key={dep.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-5 font-bold text-gray-500 text-xs">{dep.date}</td>
                    <td className="p-5 font-black text-[#4A3228] uppercase text-xs">
                      {editIdReliquat === dep.id ? (
                        <select value={editFormReliquat.type} onChange={e => setEditFormReliquat({...editFormReliquat, type: e.target.value})} className="p-2 border-2 border-orange-400 rounded-xl bg-white text-xs font-bold uppercase">
                          <option value="">-- Choisir --</option>
                          <option value="Loyer">Loyer</option>
                          <option value="Connexion">Connexion</option>
                          <option value="Salaire">Salaire</option>
                          <option value="Électricité">Électricité</option>
                          <option value="Autre">Autre</option>
                          <option value="Cotisation">Cotisation</option>
                          <option value="Achat peluche">Achat peluche</option>
                          <option value="Achat coton">Achat coton</option>
                          <option value="Transport">Transport</option>
                        </select>
                      ) : (
                        dep.type
                      )}
                    </td>
                    <td className="p-5 font-bold text-orange-500">
                      {editIdReliquat === dep.id ? (
                        <input type="number" value={editFormReliquat.montant} onChange={e => setEditFormReliquat({...editFormReliquat, montant: e.target.value})} className="p-2 border-2 border-orange-400 rounded-xl bg-white w-24 text-right text-xs font-bold" />
                      ) : (
                        Number(dep.montant || 0).toLocaleString() + ' F'
                      )}
                    </td>
                    <td className="p-5 text-gray-500 text-sm">{dep.faitPar || 'Admin'}</td>
                    <td className="p-5 text-gray-400 text-sm">{dep.description || '-'}</td>
                    <td className="p-5 text-center">
                      {editIdReliquat === dep.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => saveEditReliquat(dep.id)} className="p-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditIdReliquat(null)} className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEditReliquat(dep)} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-orange-400 hover:text-white transition-all shadow-sm">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteReliquat(dep.id)} className="p-2 bg-gray-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}