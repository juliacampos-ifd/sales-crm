// ============================================================
// PRODUCTS & PIPELINE STAGES
// ============================================================

export const PRODUCTS = {
  "3s": {
    name: "3S Checkout",
    color: "#EA1D2C",
    stages: [
      "0. Nao Iniciado", "1. Iniciado", "2. Primeiro Contato com a marca",
      "3. Apresentacao", "4. Diagnostico", "5. Demo/Showroom",
      "6. Negociacao", "7. Piloto", "8. Contrato enviado",
      "9. Contrato assinado", "10. Perdido", "11. Stand by",
      "12. Organico", "13. Reativado"
    ],
    activeStages: [
      "0. Nao Iniciado", "1. Iniciado", "2. Primeiro Contato com a marca",
      "3. Apresentacao", "4. Diagnostico", "5. Demo/Showroom",
      "6. Negociacao", "7. Piloto", "8. Contrato enviado", "9. Contrato assinado"
    ],
    closedStages: ["10. Perdido", "11. Stand by", "12. Organico", "13. Reativado"]
  },
  "saipos": {
    name: "Saipos",
    color: "#ec4899",
    stages: [
      "0. Nao Iniciado", "1. Tentativa de contato", "2. Contato inicial",
      "3. Apresentacao", "4. Negociacao", "5. Piloto",
      "6. Contrato enviado", "7. Contrato assinado",
      "8. Perdido", "9. Stand by", "10. Organico"
    ],
    activeStages: [
      "0. Nao Iniciado", "1. Tentativa de contato", "2. Contato inicial",
      "3. Apresentacao", "4. Negociacao", "5. Piloto",
      "6. Contrato enviado", "7. Contrato assinado"
    ],
    closedStages: ["8. Perdido", "9. Stand by", "10. Organico"]
  },
  "comer_fora": {
    name: "Comer Fora",
    color: "#f59e0b",
    stages: ["Buscando Reuniao", "Reuniao Agendada", "Reuniao Realizada", "Em negociacao", "Aceite"]
  },
  "get_in": {
    name: "GetIn",
    color: "#22c55e",
    stages: ["Buscando Reuniao", "Reuniao Agendada", "Reuniao Realizada", "Em negociacao", "Aceite"]
  },
  "emilia_vision": {
    name: "Emilia Vision",
    color: "#06b6d4",
    stages: ["Buscando Reuniao", "Reuniao Agendada", "Reuniao Realizada", "Em negociacao", "Aceite"]
  }
};

export const CLASSIFICACAO_COLORS = { P: "#22c55e", M: "#f59e0b", G: "#ef4444" };

export const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export const DUPLAS = [
  { name: "Lidia e Gabi", members: ["Lidia Esteves", "Gabriela Roma"] },
  { name: "Joao e Diego", members: ["Joao Biagiotti", "Diego Santos"] },
  { name: "Michel e Emerson", members: ["Michel", "Emerson"] },
];

// ============================================================
// BUSINESS DAYS
// ============================================================

const FERIADOS_2026 = [
  "2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21",
  "2026-05-01","2026-06-04","2026-09-07","2026-10-12","2026-11-02",
  "2026-11-15","2026-12-25"
];

export function isBusinessDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const iso = d.toISOString().slice(0, 10);
  return !FERIADOS_2026.includes(iso);
}

export function countBusinessDays(startDate, endDate) {
  let count = 0;
  const d = new Date(startDate);
  const end = new Date(endDate);
  while (d <= end) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function getMonthBusinessDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return countBusinessDays(first, last);
}

export function getMonthBusinessDaysMTD(year, month, today) {
  const first = new Date(year, month, 1);
  const end = new Date(Math.min(today.getTime(), new Date(year, month + 1, 0).getTime()));
  return countBusinessDays(first, end);
}
