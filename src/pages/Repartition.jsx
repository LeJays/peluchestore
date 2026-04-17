import React, { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, onSnapshot } from "firebase/firestore";

const COLORS = ["#4A3228", "#A62626", "#D97706", "#059669", "#2563EB", "#7C3AED"];

export default function Repartition() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);
  const [totalVentes, setTotalVentes] = useState(0);
  const [depenses, setDepenses] = useState([]);

  useEffect(() => {
    const [year, month] = moisSelectionne.split("-");
    const debutMois = new Date(parseInt(year), parseInt(month) - 1, 1);
    const finMois = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      const ventesMois = snap.docs
        .map(doc => doc.data())
        .filter(v => {
          const d = v.timestamp?.toDate();
          return d >= debutMois && d <= finMois;
        });

      const total = ventesMois.reduce((acc, v) => {
        let montantEncaisse = 0;
        if (v.statut === "payé" && v.statut_paiement === "TOTALEMENT_PAYÉ") {
          montantEncaisse = Number(v.prixTotal) || 0;
        } else if (v.statut === "prépayé") {
          montantEncaisse = Number(v.montantRembourse) || 0;
        }
        return acc + montantEncaisse;
      }, 0);

      setTotalVentes(total);
    });

    const unsubDepenses = onSnapshot(collection(db, "depenses"), (snap) => {
      const depensesMois = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => {
          const ts = d.timestamp?.toDate?.();
          return ts && ts >= debutMois && ts <= finMois;
        });
      setDepenses(depensesMois);
    });

    return () => {
      unsubCommandes();
      unsubDepenses();
    };
  }, [moisSelectionne]);

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

  const chargesRestantes = (() => {

  // 🔥 recalcul du surplus (comme dans fonctionnement)
  let surplusCalcule = 0;

  categories.slice(0, 5).forEach(c => {
    const montantBrut = totalVentes * c.part;
    const plafond = plafonds[c.name] || montantBrut;

    if (montantBrut > plafond) {
      surplusCalcule += (montantBrut - plafond);
    }
  });

  return categories.map(c => {
    const dejaDepense = depenses
      .filter(d => d.type === c.name)
      .reduce((acc, d) => acc + Number(d.montant || 0), 0);

    let montantAutorise = totalVentes * c.part;

    // 🔴 CAS 1 : fonctionnement → plafond
    if (plafonds[c.name] !== undefined) {
      montantAutorise = Math.min(montantAutorise, plafonds[c.name]);
    }

    // 🟢 CAS 2 : restockage → reçoit le surplus
    const restockageNames = ["Achat peluche", "Achat coton", "Transport"];
    const surplusParCategorie = surplusCalcule / restockageNames.length;

    if (restockageNames.includes(c.name)) {
      montantAutorise += surplusParCategorie;
    }

    return {
      ...c,
      dejaDepense,
      montantAutorise,
      restant: Math.max(montantAutorise - dejaDepense, 0)
    };
  });

})();

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
  const fonctionnement = chargesRestantes.slice(0, 5);
  const cotisation = chargesRestantes.slice(5, 6);
  const restockage = chargesRestantes.slice(6);

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
            {/* LEFT */}
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              >
                #{idx + 1}
              </div>

              <p className="text-[11px] font-black text-[#4A3228] uppercase">
                {item.name}
              </p>
            </div>

            {/* RIGHT */}
            <p className="text-sm font-black text-green-600">
              {item.restant.toLocaleString()} F
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {renderBloc("Fonctionnement (40%)", fonctionnement)}
      {renderBloc("Cotisation (30%)", cotisation)}
      {renderBloc("Restockage (30%)", restockage)}
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
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Charges restantes ce mois</p>

      {renderChargesRestantes()}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Répartition des charges</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderTable("Fonctionnement (40%)", fonctionnement)}
        {renderTable("Cotisation (30%)", cotisation)}
        {renderTable("Restockage (30%)", restockage)}
      </div>
      
    </div>
  );
}