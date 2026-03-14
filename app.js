// Hilfsfunktionen Einkommen/Kredit

function maxMonthlyRate(netto, rateQuote = 0.35) {
  if (netto <= 0) throw new Error("Nettoeinkommen muss > 0 sein.");
  if (!(rateQuote > 0 && rateQuote < 1)) throw new Error("rateQuote invalid");
  return netto * rateQuote;
}

function maxLoanFromIncome(netto, factor = 100) {
  if (netto <= 0) throw new Error("Nettoeinkommen muss > 0 sein.");
  if (factor <= 0) throw new Error("Faktor muss > 0 sein.");
  return netto * factor;
}

// Monatsrate aus Zins + anfänglicher Tilgung
// Jahres-Annuität = K * (zins + tilgung) -> Monatsrate = ... / 12
function monthlyRateFromInterestAndRepayment(loanAmount, interestPa, repaymentPa) {
  if (loanAmount < 0) throw new Error("Darlehensbetrag darf nicht negativ sein.");
  if (!(interestPa > 0 && interestPa < 1)) throw new Error("Zins als Dezimalzahl, z.B. 0.04.");
  if (!(repaymentPa > 0 && repaymentPa < 1)) throw new Error("Tilgung als Dezimalzahl, z.B. 0.02.");
  return loanAmount * (interestPa + repaymentPa) / 12;
}

// Tilgungsplan mit fester Rate über die Zinsbindung
function amortizationScheduleFixedRate(loanAmount, interestPa, years, monthlyRate) {
  const i = interestPa / 12;
  const n = Math.round(years * 12);
  const schedule = [];
  let rest = loanAmount;

  for (let m = 1; m <= n; m++) {
    const interest = rest * i;
    const principal = monthlyRate - interest;
    rest = rest - principal;
    if (rest < 0) rest = 0;
    schedule.push({
      month: m,
      rate: monthlyRate,
      interest,
      principal,
      remaining_debt: rest
    });
    if (rest <= 0) break; // vorzeitig schuldenfrei
  }

  return schedule;
}

// Rechner 1: Budget aus Einkommen
// -> nur maximale Rate, Kreditobergrenzen, Budget. Kein Tilgungsplan / Restschuld.
function calculateBudget({
  netto,
  ek,
  zins,
  tilgung,
  rateQuote = 0.35,
  incomeFactor = 100
}) {
  if (netto <= 0) throw new Error("Nettoeinkommen muss > 0 sein.");
  if (ek < 0) throw new Error("Eigenkapital darf nicht negativ sein.");
  if (!(zins > 0 && zins < 1)) throw new Error("Zins als Dezimalzahl, z.B. 0.04.");
  if (!(tilgung > 0 && tilgung < 1)) throw new Error("Tilgung als Dezimalzahl, z.B. 0.02.");

  // 1) Obergrenze Rate nach Einkommensregel (z.B. 35 %)
  const maxRate = maxMonthlyRate(netto, rateQuote);

  // 2) Obergrenze Kredit aus Einkommens-Faustregel
  const loanIncome = maxLoanFromIncome(netto, incomeFactor);

  // 3) Obergrenze Kredit aus maximal tragbarer Rate & Annuität (zins + tilgung)
  const annuityFactor = zins + tilgung;
  const loanFromRate = maxRate * 12 / annuityFactor;

  // 4) Empfohlene Kreditsumme = Minimum aus beiden Grenzen
  const recommendedLoan = Math.min(loanIncome, loanFromRate);

  // 5) Budget (ohne Nebenkosten)
  const purchaseBudget = recommendedLoan + ek;

  return {
    input: {
      net_income_monthly: netto,
      equity: ek,
      interest_rate_annual: zins,
      initial_repayment_annual: tilgung,
      max_rate_share_of_income: rateQuote,
      income_factor_for_loan: incomeFactor
    },
    constraints: {
      max_monthly_rate: maxRate,
      max_loan_income_rule: loanIncome,
      max_loan_annuity_rule: loanFromRate,
      recommended_max_loan: recommendedLoan
    },
    budget: {
      purchase_budget_without_costs: purchaseBudget
    }
  };
}

// Rechner 2: Rate aus Kaufpreis
// -> Rate = K * (Zins + Tilgung) / 12, Restschuld nach Zinsbindung aus Tilgungsplan.
function calculateFromPurchase({
  purchasePrice,
  purchaseCostsPercent,
  modernization,
  equity,
  interestPa,
  initialRepaymentPa,
  fixedYears
}) {
  if (purchasePrice <= 0) throw new Error("Kaufpreis muss > 0 sein.");
  if (purchaseCostsPercent < 0) throw new Error("Nebenkosten % dürfen nicht negativ sein.");
  if (modernization < 0) throw new Error("Modernisierung darf nicht negativ sein.");
  if (equity < 0) throw new Error("Eigenkapital darf nicht negativ sein.");
  if (!(interestPa > 0 && interestPa < 1)) throw new Error("Zins als Dezimalzahl angeben, z.B. 0.04.");
  if (!(initialRepaymentPa > 0 && initialRepaymentPa < 1)) throw new Error("Tilgung als Dezimalzahl, z.B. 0.02.");
  if (fixedYears <= 0) throw new Error("Zinsbindung muss > 0 sein.");

  const purchaseCosts = purchasePrice * (purchaseCostsPercent / 100);
  const totalCosts = purchasePrice + purchaseCosts + modernization;

  let loanAmount = totalCosts - equity;
  if (loanAmount < 0) loanAmount = 0;

  // Rate aus Annuität (zins + anfängliche Tilgung)
  const monthlyRate = monthlyRateFromInterestAndRepayment(loanAmount, interestPa, initialRepaymentPa);

  // Tilgung nur über die Zinsbindung mit dieser Rate
  const schedule = amortizationScheduleFixedRate(loanAmount, interestPa, fixedYears, monthlyRate);
  const remainingDebtAtFixEnd = schedule.length
    ? schedule[schedule.length - 1].remaining_debt
    : loanAmount;

  return {
    input: {
      purchase_price: purchasePrice,
      purchase_costs_percent: purchaseCostsPercent,
      modernization,
      equity,
      interest_rate_annual: interestPa,
      initial_repayment_annual: initialRepaymentPa,
      fixed_rate_years: fixedYears
    },
    derived: {
      purchase_costs: purchaseCosts,
      total_costs: totalCosts,
      loan_amount: loanAmount
    },
    result: {
      monthly_rate: monthlyRate,
      remaining_debt_at_fix_end: remainingDebtAtFixEnd,
      schedule
    }
  };
}

// DOM-Initialisierung: Tabs + beide Formulare
document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Rechner 1: Budget aus Einkommen
  const form = document.getElementById("calc-form");
  const summaryEl = document.getElementById("result-summary");
  const detailsEl = document.getElementById("result-details");

  if (form && summaryEl && detailsEl) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const netto = Number(document.getElementById("netto").value);
        const ek = Number(document.getElementById("ek").value);
        const zinsProzent = Number(document.getElementById("zins").value);
        const tilgungProzent = Number(document.getElementById("tilgung").value);
        // zinsbindung wird hier nicht mehr benötigt

        const result = calculateBudget({
          netto,
          ek,
          zins: zinsProzent / 100,
          tilgung: tilgungProzent / 100
        });

        const c = result.constraints;
        const b = result.budget;

        summaryEl.innerHTML = `
          <p>Maximale Monatsrate (z.&nbsp;B. 35&nbsp;% vom Netto): <strong>${c.max_monthly_rate.toFixed(2)} €</strong></p>
          <p>Max. Kreditsumme nach Einkommensregel: <strong>${c.max_loan_income_rule.toFixed(2)} €</strong></p>
          <p>Max. Kreditsumme nach Zins/Tilgung-Regel: <strong>${c.max_loan_annuity_rule.toFixed(2)} €</strong></p>
          <p>Empfohlene maximale Kreditsumme: <strong>${c.recommended_max_loan.toFixed(2)} €</strong></p>
          <p>Kaufbudget (ohne Nebenkosten): <strong>${b.purchase_budget_without_costs.toFixed(2)} €</strong></p>
        `;

        detailsEl.textContent = ""; // keine Restschuld / Plan mehr
      } catch (err) {
        summaryEl.textContent = `Fehler: ${err.message}`;
        detailsEl.textContent = "";
      }
    });
  }

  // Rechner 2: Rate aus Kaufpreis
  const purchaseForm = document.getElementById("purchase-form");
  const purchaseSummaryEl = document.getElementById("purchase-summary");
  const purchaseDetailsEl = document.getElementById("purchase-details");

  if (purchaseForm && purchaseSummaryEl && purchaseDetailsEl) {
    purchaseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const purchasePrice = Number(document.getElementById("purchase-price").value);
        const purchaseCostsPercent = Number(document.getElementById("purchase-costs-percent").value);
        const modernization = Number(document.getElementById("modernization").value);
        const equity = Number(document.getElementById("ek-purchase").value);
        const zinsProzent = Number(document.getElementById("zins-purchase").value);
        const tilgungProzent = Number(document.getElementById("tilgung-purchase").value);
        const fixedYears = Number(document.getElementById("zinsbindung-purchase").value);

        const result = calculateFromPurchase({
          purchasePrice,
          purchaseCostsPercent,
          modernization,
          equity,
          interestPa: zinsProzent / 100,
          initialRepaymentPa: tilgungProzent / 100,
          fixedYears
        });

        const d = result.derived;
        const r = result.result;

        purchaseSummaryEl.innerHTML = `
          <p>Gesamtkosten (inkl. Nebenkosten & Modernisierung): <strong>${d.total_costs.toFixed(2)} €</strong></p>
          <p>Darlehensbetrag: <strong>${d.loan_amount.toFixed(2)} €</strong></p>
          <p>Monatliche Rate (Zins + Tilgung): <strong>${r.monthly_rate.toFixed(2)} €</strong></p>
          <p>Restschuld nach Zinsbindung: <strong>${r.remaining_debt_at_fix_end.toFixed(2)} €</strong></p>
        `;

        if (r.schedule.length) {
          const first = r.schedule[0];
          const last = r.schedule[r.schedule.length - 1];
          purchaseDetailsEl.innerHTML = `
            <p>Erste Rate: ${first.rate.toFixed(2)} € (Zins ${first.interest.toFixed(2)} €, Tilgung ${first.principal.toFixed(2)} €)</p>
            <p>Letzter Monat im Plan: ${last.month}, Restschuld: ${last.remaining_debt.toFixed(2)} €</p>
          `;
        } else {
          purchaseDetailsEl.textContent = "Kein Darlehen nötig (Eigenkapital deckt alle Kosten).";
        }
      } catch (err) {
        purchaseSummaryEl.textContent = `Fehler: ${err.message}`;
        purchaseDetailsEl.textContent = "";
      }
    });
  }
});
