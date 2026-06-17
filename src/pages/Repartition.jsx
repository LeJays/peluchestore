import React, { useState, useEffect, useMemo } from "react";
import toast from 'react-hot-toast';
import { db, auth } from "../firebase/config";
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

const COLORS = ["#4A3228", "#A62626", "#D97706", "#059669", "#2563EB", "#7C3AED"];

export default function Repartition() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);
  const [totalVentes, setTotalVentes] = useState(0);
  const [depenses, setDepenses] = useState([]);
  const [allCommandes, setAllCommandes] = useState([]);
  const [allDepenses, setAllDepenses] = useState([]);
  const [allDepensesReliquat, setAllDepensesReliquat] = useState([]);
  const [nomUtilisateur, setNomUtilisateur] = useState('Admin');

  // Form reliquat
  const [formReliquat, setFormReliquat] = useState({ type: '', montant: '' });
  const [editIdReliquat, setEditIdReliquat] = useState(null);
  const [editFormReliquat, setEditFormReliquat] = useState({ type: '', montant: '' });

  useEffect(() => {
    const [year, month] = moisSelectionne.split("-");
    const debutMois = new Date(parseInt(year), parseInt(month) - 1, 1);
    const finMois = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      const commandes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllCommandes(commandes);

      const ventesMois = commandes.filter(v => {
        const d = v.timestamp?.toDate?.() || (v.dateJS?.seconds ? new Date(v.dateJS.seconds * 1000) : null);
        return d && d >= debutMois && d <= finMois;
      });

      const total = ventesMois.reduce((acc, v) => {
        let montantEncaisse = 0;
        if ((v.statut === "payé" && v.statut_paiement === "TOTALEMENT_PAYÉ") || v.statut_paiement === "ATTENTE_LIVRAISON") {
          montantEncaisse = Number(v.prixTotal) || 0;
        } else if (v.statut === "prépayé") {
          montantEncaisse = Number(v.montantRembourse) || 0;
        }
        return acc + montantEncaisse;
      }, 0);

      setTotalVentes(total);
    });

    const unsubDepenses = onSnapshot(collection(db, "depenses"), (snap) => {
      const allDeps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllDepenses(allDeps);
      const depensesMois = allDeps.filter(d => {
        const ts = d.timestamp?.toDate?.();
        return ts && ts >= debutMois && ts <= finMois;
      });
      setDepenses(depensesMois);
    });

    const unsubDepensesReliquat = onSnapshot(collection(db, 'depenses_reliquat'), snap => {
      setAllDepensesReliquat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCommandes();
      unsubDepenses();
      unsubDepensesReliquat();
    };
  }, [moisSelectionne]);

  useEffect(() => {
    const getConnectedUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "utilisateurs", user.uid));
          if (userDoc.exists()) setNomUtilisateur(userDoc.data().nom || userDoc.data().name);
        } catch (e) { setNomUtilisateur('Admin'); }
      }
    };
    getConnectedUserName();
  }, []);

  const plafonds = {
    "Loyer": 50000,
    "Connexion": 20000,
    "Salaire": 100000,
    "Électricité": 15000,
    "Autre": 30000
  };

  let surplus = 0;



  // Définition des catégories
  const categories = [
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

  const fonctionnement = categories.slice(0, 5).map(c => {
    const montantBrut = totalVentes * c.part;
    const plafond = plafonds[c.name] || montantBrut;

    if (montantBrut > plafond) {
      surplus += (montantBrut - plafond);
    }

    return {
      ...c,
      montant: Math.min(montantBrut, plafond)
    };
  });


  //const fonctionnement = categories.slice(0, 5).map(c => ({ ...c, montant: totalVentes * c.part }));
  const cotisation = categories.slice(5, 6).map(c => ({ ...c, montant: totalVentes * c.part }));
  const restockageCategories = categories.slice(6);
  const surplusParCategorie = surplus / restockageCategories.length;

  const restockage = restockageCategories.map(c => ({ 
    ...c, 
    montant: (totalVentes * c.part) + surplusParCategorie
  }));

  // --- LOGIQUE PARTAGÉE POUR RÉPARTITION MENSUELLE ET RELIQUAT ---
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

    const plafondsLocal = {
      "Loyer": 50000,
      "Connexion": 20000,
      "Salaire": 100000,
      "Électricité": 15000,
      "Autre": 30000
    };

    let surplusLocal = 0;
    categoriesDef.slice(0, 5).forEach(c => {
      const montantBrut = sales * c.part;
      const plafond = plafondsLocal[c.name];
      if (montantBrut > plafond) surplusLocal += (montantBrut - plafond);
    });

    const restockageNames = ["Achat peluche", "Achat coton", "Transport"];
    const surplusParCategorieLocal = surplusLocal / restockageNames.length;

    return categoriesDef.map(c => {
      let montantAutorise = sales * c.part;
      if (plafondsLocal[c.name] !== undefined) {
        montantAutorise = Math.min(montantAutorise, plafondsLocal[c.name]);
      }
      if (restockageNames.includes(c.name)) montantAutorise += surplusParCategorieLocal;

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

  const aggregatedRestes = useMemo(() => {
    const totals = {};
    const categoriesList = ["Loyer","Connexion","Salaire","Électricité","Autre","Cotisation","Achat peluche","Achat coton","Transport"];
    categoriesList.forEach(cat => totals[cat] = 0);

    let d = new Date(moisSelectionne + '-01');
    for (let i = 0; i < 12; i++) {
      const mStr = d.toISOString().slice(0, 7);
      const budget = calculateBudgetForMonth(mStr, allCommandes, allDepenses);
      budget.forEach(b => { totals[b.name] += b.reste; });
      d.setMonth(d.getMonth() - 1);
    }

    allDepensesReliquat.forEach(dep => {
      if (totals[dep.type] !== undefined) totals[dep.type] -= Number(dep.montant || 0);
    });

    return totals;
  }, [moisSelectionne, allCommandes, allDepenses, allDepensesReliquat]);

  // Somme cumulée des montants autorisés (pour affichage 'montant autorisé' en cumul)
  const aggregatedMontantsAutorises = useMemo(() => {
    const totals = {};
    const categoriesList = ["Loyer","Connexion","Salaire","Électricité","Autre","Cotisation","Achat peluche","Achat coton","Transport"];
    categoriesList.forEach(cat => totals[cat] = 0);

    // inclure mois sélectionné + 11 mois précédents
    for (let i = 0; i <= 11; i++) {
      const tmp = new Date();
      tmp.setMonth(tmp.getMonth() - i + (new Date().getMonth() - new Date(moisSelectionne + '-01').getMonth()));
      // Instead of complex relative, compute month strings by iterating from selected month
    }

    // Simpler: iterate from selected month backwards 11 months
    let d = new Date(moisSelectionne + '-01');
    for (let i = 0; i < 12; i++) {
      const mStr = d.toISOString().slice(0,7);
      const budget = calculateBudgetForMonth(mStr, allCommandes, allDepenses);
      budget.forEach(b => { totals[b.name] += b.montantAutorise; });
      d.setMonth(d.getMonth() - 1);
    }

    return totals;
  }, [moisSelectionne, allCommandes, allDepenses]);

  const renderTable = (title, data) => (
    <div className="bg-white p-6 rounded-[3rem] border border-gray-100 shadow-sm mb-8">
      <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest text-center">{title}</h3>
      <div className="space-y-4">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-gray-200 transition-all"
          >
            <div className="flex items-center gap-4 w-1/2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"
                   style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                #{idx + 1}
              </div>
              <p className="text-[11px] font-black text-[#4A3228] uppercase">{item.name}</p>
            </div>

            <p className="text-sm font-black text-green-600 w-40 text-right">
              {item.montant.toLocaleString()} F
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChargesRestantes = () => {
    const chargesCumul = categories.map(c => ({
      name: c.name,
      reste: Math.max(aggregatedRestes[c.name] ?? 0, 0),
    }));

    const fonctionnementRestant = chargesCumul.slice(0, 5);
    const cotisationRestant = chargesCumul.slice(5, 6);
    const restockageRestant = chargesCumul.slice(6);

    const renderBloc = (title, data) => (
      <div className="bg-white p-6 rounded-[3rem] border border-gray-100 shadow-sm">
        <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest text-center">
          {title}
        </h3>
        <div className="space-y-4">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-gray-100 p-4 rounded-2xl"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                >
                  #{idx + 1}
                </div>
                <p className="text-[11px] font-black text-[#4A3228] uppercase">{item.name}</p>
              </div>
              <p className="text-sm font-black text-green-600">
                {item.reste.toLocaleString()} F
              </p>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderBloc("Fonctionnement (40%)", fonctionnementRestant)}
        {renderBloc("Cotisation (30%)", cotisationRestant)}
        {renderBloc("Restockage (30%)", restockageRestant)}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
        {/* Sélection du mois */}
        <div className="flex items-center gap-4 mb-6">
            <label className="font-black text-[#4A3228] uppercase text-xs">Sélection du mois :</label>
            <input
            type="month"
            value={moisSelectionne}
            onChange={(e) => setMoisSelectionne(e.target.value)}
            className="bg-gray-50 border-none rounded-xl p-2 font-bold text-[#4A3228] cursor-pointer"
            />
        </div>
      
      {/* RECETTE DU MOIS - style card type Performance */}
      <div className="bg-white p-6 rounded-[2rem] border-l-8 border-green-500 shadow-md text-left">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recette du mois</p>
        <h2 className="text-3xl font-black text-[#4A3228] mt-2">{totalVentes.toLocaleString()} F</h2>
      </div>
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Charges restantes (cumul 12 mois)</p>

      {renderChargesRestantes()}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Répartition des charges</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderTable("Fonctionnement (40%)", fonctionnement)}
        {renderTable("Cotisation (30%)", cotisation)}
        {renderTable("Restockage (30%)", restockage)}
      </div>

        {/* TOTAUX GLOBAUX */}
        <div className="bg-white p-6 rounded-[3rem] border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Totaux globaux des répartitions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(aggregatedRestes).map(([cat, val], idx) => (
              <div key={cat} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-[#4A3228] uppercase">{cat}</p>
                  <p className="text-sm text-gray-500">Cumul 12 mois</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-green-600">{val.toLocaleString()} F</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-right">
            <p className="text-sm font-black text-gray-500">Total cumulés :</p>
            <p className="text-2xl font-black text-[#4A3228]">{Object.values(aggregatedRestes).reduce((a,b) => a + b, 0).toLocaleString()} F</p>
          </div>
        </div>
      
    </div>
  );
}