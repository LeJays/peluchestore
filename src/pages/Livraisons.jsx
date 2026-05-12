import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { 
  collection, onSnapshot, query, where, orderBy, 
  updateDoc, doc, limit, deleteDoc, getDoc 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Trash2 } from 'lucide-react'; // Pour une icône sympa

export default function Livraisons() {
  const [commandesEnAttente, setCommandesEnAttente] = useState([]);
  const [historiqueLivraisons, setHistoriqueLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtreClient, setFiltreClient] = useState("");
  const [filtreArticle, setFiltreArticle] = useState("");
  const [filtreLivreur, setFiltreLivreur] = useState("");
  const [filtreDate, setFiltreDate] = useState("");

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
      limit(3000)
    );

    const unsubAttente = onSnapshot(qAttente, (snap) => {
      setCommandesEnAttente(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const parseDateFR = (dateStr) => {
  if (!dateStr) return new Date(0);

  try {
    if (typeof dateStr === "string") {
      const [datePart, timePart] = dateStr.split(" ");
      const [day, month, year] = datePart.split("/");
      const [hour = 0, minute = 0, second = 0] = (timePart || "").split(":");

      return new Date(year, month - 1, day, hour, minute, second);
    }

    if (dateStr.seconds) {
      return new Date(dateStr.seconds * 1000);
    }

    return new Date(dateStr);
  } catch {
    return new Date(0);
  }
};

const unsubLivre = onSnapshot(qLivre, (snap) => {
  const data = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const sorted = data.sort((a, b) => {
    const dateA = parseDateFR(a.date_livraison_reelle);
    const dateB = parseDateFR(b.date_livraison_reelle);
    return dateB.getTime() - dateA.getTime();
  });

  setHistoriqueLivraisons(sorted);
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
      
      toast("Commande supprimée et stock rétabli !");
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'annulation : " + err.message);
    }
  };

  const validerLivraison = async (commande) => {
    if (!window.confirm(`Confirmer la livraison de ${commande.client} ?`)) return;

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        toast("Utilisateur non connecté");
        return;
      }

      const userRef = doc(db, "utilisateurs", user.uid);
      const userSnap = await getDoc(userRef);

      const nomLivreur = userSnap.exists()
        ? userSnap.data().nom || user.email
        : user.email;

      const updates = {
        statut_livraison: "LIVRÉ",
        date_livraison_reelle: new Date().toLocaleString("fr-FR"),
        livreur_final: nomLivreur
      };

      if (
        commande.statut === "payé" ||
        commande.statut_paiement === "TOTALEMENT_PAYÉ"
      ) {
        updates.statut_paiement = "TOTALEMENT_PAYÉ";
      }

      await updateDoc(doc(db, "commandes", commande.id), updates);
    } catch (err) {
      toast("Erreur : " + err.message);
    }
  };

 // Fonction pour calculer le prix selon la taille et la catégorie
const calculerPrixUnitaire = (taille, categorie) => {
  // Convertir en majuscules pour éviter les problèmes de casse
  const tailleUpper = taille.toUpperCase();
  const categorieUpper = categorie.toUpperCase();

  if (categorieUpper === "PREMIUM") {
    if (tailleUpper === "80") return 15000;
    if (tailleUpper === "100") return 25000;
  } else if (categorieUpper === "STANDARD") {
    if (tailleUpper === "80") return 10000;
    if (tailleUpper === "100") return 20000;
    if (tailleUpper === "140") return 40000;
  }

  // Valeur par défaut si aucune correspondance
  return 0;
};

// Fonction pour récupérer taille et catégorie depuis pelucheId
const recupererInfosPeluche = async (pelucheId) => {
  try {
    const pelucheRef = doc(db, "peluches", pelucheId);
    const pelucheSnap = await getDoc(pelucheRef);

    if (!pelucheSnap.exists()) return null;

    const data = pelucheSnap.data();
    return {
      taille: data.taille || "N/A",
      categorie: data.categorie || "N/A"
    };
  } catch (err) {
    console.error("Erreur récupération peluche :", err);
    return null;
  }
};

// Fonction principale pour générer la facture
const genererFacture = async (commande) => {
  try {
    // Récupérer les infos peluche
    const infos = await recupererInfosPeluche(commande.pelucheId);

    if (!infos) {
      toast("Infos peluche introuvables");
      return;
    }

    const { taille, categorie } = infos;

    // Calcul du prix unitaire et total
    const prixUnitaire = calculerPrixUnitaire(taille, categorie);
    const total = prixUnitaire * Number(commande.quantite);

    // Récupération de la date de livraison réelle ou de la date de commande
    const date = commande.date_livraison_reelle
      ? commande.date_livraison_reelle.toDate
        ? commande.date_livraison_reelle.toDate().toLocaleString("fr-FR")
        : commande.date_livraison_reelle
      : commande.date || "—";

    // Création du HTML de la facture
    const factureHTML = `
    <html>
      <head>
        <title>Facture - PelucheStore Cameroon</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
          .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #A62626; padding-bottom: 15px; }
          .logo { width: 90px; }
          h1 { margin: 0; color: #A62626; font-size: 26px; }
          .infos { margin-top: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .total { margin-top: 20px; font-size: 18px; font-weight: bold; text-align: right; color: #A62626; }
          .footer { margin-top: 40px; font-size: 12px; text-align: center; color: #666; }
        </style>
      </head>

      <body>
        <div class="header">
          <img src="/logo.jpeg" class="logo" />
          <div>
            <h1>PelucheStore Cameroon</h1>
            <p><strong>Date :</strong> ${date}</p>
          </div>
        </div>

        <div class="infos">
          <p><strong>Client :</strong> ${commande.client}</p>
          <p><strong>Téléphone :</strong> ${commande.tel || "—"}</p>
          <p><strong>Vendeur :</strong> ${commande.livreur_final || "Admin"}</p>
          <p><strong>Taille :</strong> ${taille}</p>
          <p><strong>Catégorie :</strong> ${categorie}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${commande.nomArticle}</td>
              <td>${commande.quantite}</td>
              <td>${total.toLocaleString()} FCFA</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          Total à payer : ${total.toLocaleString()} FCFA
        </div>

        <div class="footer">
          Merci pour votre confiance 🤝<br/>
          <strong>PelucheStore Cameroon</strong><br/>
          Des cadeaux qui parlent au cœur 💝
        </div>
      </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(factureHTML);
    win.document.close();
    win.print();

  } catch (err) {
    toast("Erreur lors de la génération de la facture : " + err.message);
  }
};

const historiqueFiltre = historiqueLivraisons.filter((h) => {

  const clientMatch = h.client
    ?.toLowerCase()
    .includes(filtreClient.toLowerCase());

  const articleMatch = h.nomArticle
    ?.toLowerCase()
    .includes(filtreArticle.toLowerCase());

  const livreurMatch = (h.livreur_final || "")
    .toLowerCase()
    .includes(filtreLivreur.toLowerCase());

  const dateMatch = filtreDate
    ? formatDate(h.date_livraison_reelle).includes(filtreDate)
    : true;

  return clientMatch && articleMatch && livreurMatch && dateMatch;
});


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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

  <input
    type="text"
    placeholder="🔎 Client"
    value={filtreClient}
    onChange={(e) => setFiltreClient(e.target.value)}
    className="border rounded-xl px-3 py-2 text-sm"
  />

  <input
    type="text"
    placeholder="📦 Article"
    value={filtreArticle}
    onChange={(e) => setFiltreArticle(e.target.value)}
    className="border rounded-xl px-3 py-2 text-sm"
  />

  <input
    type="text"
    placeholder="👨‍💼 Fait par"
    value={filtreLivreur}
    onChange={(e) => setFiltreLivreur(e.target.value)}
    className="border rounded-xl px-3 py-2 text-sm"
  />

  <input
    type="text"
    placeholder="📅 Date (ex: 11/03/2026)"
    value={filtreDate}
    onChange={(e) => setFiltreDate(e.target.value)}
    className="border rounded-xl px-3 py-2 text-sm"
  />

</div>
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
                <th className="pb-4 px-2 text-center">Paiement</th>
                <th className="pb-4 px-2 text-right">Montant</th>
                <th className="pb-4 px-2 text-center">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historiqueFiltre.map((h) => (
                <tr key={h.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-5 px-2 text-[10px] font-bold text-gray-400">
                    {formatDate(h.date_livraison_reelle)}
                  </td>
                  <td className="py-5 px-2 font-black text-[#4A3228] text-xs uppercase">
                    {h.client}
                  </td>
                  <td className="py-5 px-2 text-[10px] font-bold text-gray-600 uppercase">
                    {h.nomArticle} <span className="text-orange-500 ml-1">x{h.quantite}</span>
                  </td>
                  <td className="py-5 px-2 text-center">
                    <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider group-hover:bg-[#1A1C23] group-hover:text-white transition-all">
                      {h.livreur_final || "Admin"}
                    </span>
                  </td>
                  <td className="py-5 px-2 text-center">
                    <span className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider
                      ${
                        h.paiement === "Orange Money"
                          ? "bg-orange-100 text-orange-600"
                          : h.paiement === "Mobile Money"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                      {h.paiement}
                    </span>
                  </td>
                  <td className="py-5 px-2 text-right font-black text-[#A62626] text-xs italic">
                    {Number(h.prixTotal).toLocaleString()} F
                  </td>
                  <td className="py-5 px-2 text-center">
                    <button
                      onClick={() => genererFacture(h)}
                      className="bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white p-2 rounded-xl transition"
                      title="Générer facture"
                    >
                      🧾
                    </button>
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