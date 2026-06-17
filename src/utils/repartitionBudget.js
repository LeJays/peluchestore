export const PLAFONDS = {
  Loyer: 50000,
  Connexion: 20000,
  Salaire: 100000,
  Électricité: 15000,
  Autre: 30000,
};

export const CATEGORIES = [
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

export const CATEGORIES_LIST = CATEGORIES.map((c) => c.name);

const RESTOCKAGE_NAMES = ["Achat peluche", "Achat coton", "Transport"];

export function getRecordDate(record) {
  if (record?.timestamp?.toDate) return record.timestamp.toDate();
  if (record?.dateJS?.seconds) return new Date(record.dateJS.seconds * 1000);
  if (record?.timestamp instanceof Date) return record.timestamp;
  return null;
}

function formatMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthStart(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function matchesExpenseCategory(expense, categoryName) {
  if (categoryName === "Autre") {
    const typeOrig = (expense.typeOriginal || expense.type || "").toLowerCase();
    return typeOrig === "autre" || expense.type === "Autre";
  }
  return expense.type === categoryName;
}

export function calculateBudgetForMonth(monthStr, commands, expenses) {
  const debut = parseMonthStart(monthStr);
  const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0, 23, 59, 59);

  const sales = commands
    .filter((c) => {
      const d = getRecordDate(c);
      return d && d >= debut && d <= fin;
    })
    .reduce((acc, v) => {
      let montant = 0;
      if (
        (v.statut === "payé" && v.statut_paiement === "TOTALEMENT_PAYÉ") ||
        v.statut_paiement === "ATTENTE_LIVRAISON"
      ) {
        montant = Number(v.prixTotal) || 0;
      } else if (v.statut === "prépayé") {
        montant = Number(v.montantRembourse) || 0;
      }
      return acc + montant;
    }, 0);

  let surplusLocal = 0;
  CATEGORIES.slice(0, 5).forEach((c) => {
    const montantBrut = sales * c.part;
    const plafond = PLAFONDS[c.name] ?? montantBrut;
    if (montantBrut > plafond) surplusLocal += montantBrut - plafond;
  });

  const surplusParCategorie = surplusLocal / RESTOCKAGE_NAMES.length;

  return CATEGORIES.map((c) => {
    let montantAutorise = sales * c.part;
    if (PLAFONDS[c.name] !== undefined) {
      montantAutorise = Math.min(montantAutorise, PLAFONDS[c.name]);
    }
    if (RESTOCKAGE_NAMES.includes(c.name)) {
      montantAutorise += surplusParCategorie;
    }

    const dejaDepense = expenses
      .filter((d) => {
        const ts = d.timestamp?.toDate?.();
        return ts && ts >= debut && ts <= fin && matchesExpenseCategory(d, c.name);
      })
      .reduce((acc, d) => acc + Number(d.montant || 0), 0);

    return {
      name: c.name,
      montantAutorise,
      dejaDepense,
      reste: montantAutorise - dejaDepense,
    };
  });
}

/**
 * Reste cumulé par catégorie :
 * cumul historique (tous les mois avant) + répartition du mois de fin − dépenses du mois − reliquat.
 * Équivalent à la somme chronologique de (montantAutorise - dejaDepense) jusqu'au mois de fin inclus.
 */
export function calculateRestesCumules({
  commands,
  expenses,
  reliquat = [],
  endMonthStr,
}) {
  const totals = {};
  CATEGORIES_LIST.forEach((cat) => {
    totals[cat] = 0;
  });

  const end = parseMonthStart(endMonthStr);
  const candidates = [...commands, ...expenses].map(getRecordDate).filter(Boolean);
  const oldest = candidates.length > 0
    ? new Date(Math.min(...candidates.map((d) => d.getTime())))
    : end;

  const cursor = new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  while (cursor <= end) {
    const budget = calculateBudgetForMonth(formatMonth(cursor), commands, expenses);
    budget.forEach((b) => {
      totals[b.name] += b.montantAutorise - b.dejaDepense;
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  reliquat.forEach((dep) => {
    if (totals[dep.type] !== undefined) {
      totals[dep.type] -= Number(dep.montant || 0);
    }
  });

  CATEGORIES_LIST.forEach((cat) => {
    totals[cat] = Math.max(totals[cat] ?? 0, 0);
  });

  return totals;
}

export function getLimitCategoryForExpense(type, depenseType) {
  if (type === "Autre" || type === "autre") return "Autre";
  return depenseType;
}
