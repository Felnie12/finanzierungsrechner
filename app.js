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

function annuityMonthlyRate(kredit, interestPa, years) {
  if (kredit <= 0) throw new Error("Kreditsumme muss > 0 sein.");
  if (interestPa <= 0) throw new Error("Zins muss > 0 sein.");
  if (years <= 0) throw new Error("Laufzeit muss > 0 sein.");

  const i = interestPa / 12;
  const n = Math.round(years * 12);
  const factor = Math.pow(1 + i, n);
  return kredit * (i * factor) / (factor - 1);
}

function amortizationSchedule(kredit, interestPa, years) {
  const i = interestPa / 12;
  const n = Math.round(years * 12);
  const rate = annuityMonthlyRate(kredit, interestPa, years);
  const schedule = [];
  let rest = kredit;

  for (let m = 1; m <= n; m++) {
    const zins = rest * i;
    const tilgung = rate - zins;
    rest = rest - tilgung;
    if (rest < 0) rest = 0;
    schedule.push({
      month: m,
      rate,
      interest: zins,
      principal: tilgung,
      remaining_debt: rest
    });
    if (rest <= 0) break;
  }
  return schedule;
}



function calculateBudget({
  netto,
  ek,
  zins,
  zinsbindung,
  tilgung,
  rateQuote = 0.35,
  incomeFactor = 100
}) {
  if (netto <= 0) throw new Error("Nettoeinkommen muss > 0 sein.");
  if (ek < 0) throw new Error("Eigenkapital darf nicht negativ sein.");
  if (!(zins > 0 && zins < 1)) throw new Error("Zins als Dezimalzahl, z.B. 0.04.");
  if (!(tilgung > 0 && tilgung < 1)) throw new Error("Tilgung als Dezimalzahl, z.B. 0.02.");
  if (zinsbindung <= 0) throw new Error("Zinsbindung muss > 0 sein.");

  const maxRate = maxMonthlyRate(netto, rateQuote);
  const loanIncome = maxLoanFromIncome(netto, incomeFactor);

  const annuityFactor = zins + tilgung;
  const loanFromRate = maxRate * 12 / annuityFactor;

  const recommendedLoan = Math.min(loanIncome, loanFromRate);
  const purchaseBudget = recommendedLoan + ek;

  const schedule = amortizationSchedule(recommendedLoan, zins, zinsbindung);
  const remainingDebtAtFixEnd = schedule.length
    ? schedule[schedule.length - 1].remaining_debt
    : recommendedLoan;
  const fixEndMonth = schedule.length ? schedule[schedule.length - 1].month : null;

  return {
    input: {
      net_income_monthly: netto,
      equity: ek,
      interest_rate_annual: zins,
      fixed_rate_years: zinsbindung,
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
    },
    projection: {
      remaining_debt_at_fix_end: remainingDebtAtFixEnd,
      fix_end_month: fixEndMonth
    },
    schedule
  };
}




document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calc-form");
  const summaryEl = document.getElementById("result-summary");
  const detailsEl = document.getElementById("result-details");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const netto = Number(document.getElementById("netto").value);
      const ek = Number(document.getElementById("ek").value);
      const zinsProzent = Number(document.getElementById("zins").value);
      const tilgungProzent = Number(document.getElementById("tilgung").value);
      const zinsbindung = Number(document.getElementById("zinsbindung").value);

      const result = calculateBudget({
        netto,
        ek,
        zins: zinsProzent / 100,
        tilgung: tilgungProzent / 100,
        zinsbindung
      });

      const c = result.constraints;
      const b = result.budget;
      const p = result.projection;

      summaryEl.innerHTML = `
        <p>Maximale Monatsrate: <strong>${c.max_monthly_rate.toFixed(2)} €</strong></p>
        <p>Empfohlene Kreditsumme: <strong>${c.recommended_max_loan.toFixed(2)} €</strong></p>
        <p>Kaufbudget (ohne Nebenkosten): <strong>${b.purchase_budget_without_costs.toFixed(2)} €</strong></p>
        <p>Restschuld nach Zinsbindung: <strong>${p.remaining_debt_at_fix_end.toFixed(2)} €</strong></p>
      `;

      const first = result.schedule[0];
      const last = result.schedule[result.schedule.length - 1];

      detailsEl.innerHTML = `
        <p>Erste Rate: ${first.rate.toFixed(2)} € (Zins ${first.interest.toFixed(2)} €, Tilgung ${first.principal.toFixed(2)} €)</p>
        <p>Letzter Monat im Plan: ${last.month}, Restschuld: ${last.remaining_debt.toFixed(2)} €</p>
      `;
    } catch (err) {
      summaryEl.textContent = `Fehler: ${err.message}`;
      detailsEl.textContent = "";
    }
  });
});

