/**
 * 연봉 실수령액 계산기
 * 기준: 2025년 4대보험 요율 + 간이 소득세 추정
 */

const RATES = {
  nationalPension: 0.045,
  nationalPensionMaxBase: 6_370_000, // 월 기준소득월액 상한 (2025)
  healthInsurance: 0.03545,
  longTermCare: 0.1295, // 건강보험료 대비
  employmentInsurance: 0.009,
};

const EARNED_INCOME_DEDUCTION = [
  { limit: 5_000_000, rate: 0.7 },
  { limit: 15_000_000, rate: 0.4, base: 3_500_000 },
  { limit: 45_000_000, rate: 0.15, base: 7_500_000 },
  { limit: 100_000_000, rate: 0.05, base: 12_000_000 },
  { limit: Infinity, rate: 0.02, base: 14_750_000 },
];

const TAX_BRACKETS = [
  { limit: 14_000_000, rate: 0.06, progressive: 0 },
  { limit: 50_000_000, rate: 0.15, progressive: 1_080_000 },
  { limit: 88_000_000, rate: 0.24, progressive: 5_220_000 },
  { limit: 150_000_000, rate: 0.35, progressive: 14_900_000 },
  { limit: 300_000_000, rate: 0.38, progressive: 37_400_000 },
  { limit: 500_000_000, rate: 0.4, progressive: 94_400_000 },
  { limit: 1_000_000_000, rate: 0.42, progressive: 174_400_000 },
  { limit: Infinity, rate: 0.45, progressive: 384_400_000 },
];

const els = {
  salary: document.getElementById("salary"),
  dependents: document.getElementById("dependents"),
  nontaxable: document.getElementById("nontaxable"),
  monthlyNet: document.getElementById("monthlyNet"),
  annualNet: document.getElementById("annualNet"),
  monthlyGross: document.getElementById("monthlyGross"),
  totalDeduction: document.getElementById("totalDeduction"),
  nationalPension: document.getElementById("nationalPension"),
  healthInsurance: document.getElementById("healthInsurance"),
  longTermCare: document.getElementById("longTermCare"),
  employmentInsurance: document.getElementById("employmentInsurance"),
  incomeTax: document.getElementById("incomeTax"),
  localTax: document.getElementById("localTax"),
};

function parseMoney(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatMoney(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatInput(el) {
  const amount = parseMoney(el.value);
  el.value = amount ? amount.toLocaleString("ko-KR") : "";
  return amount;
}

function calcEarnedIncomeDeduction(annualSalary) {
  let prev = 0;
  for (const bracket of EARNED_INCOME_DEDUCTION) {
    if (annualSalary <= bracket.limit) {
      return (bracket.base || 0) + (annualSalary - prev) * bracket.rate;
    }
    prev = bracket.limit;
  }
  return 0;
}

function calcIncomeTaxAnnual(taxBase) {
  if (taxBase <= 0) return 0;

  let prev = 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxBase <= bracket.limit) {
      return bracket.progressive + (taxBase - prev) * bracket.rate;
    }
    prev = bracket.limit;
  }
  return 0;
}

function calculate({ annualSalary, dependents, monthlyNontaxable }) {
  const monthlyGross = annualSalary / 12;
  const taxableMonthlyBase = Math.max(monthlyGross - monthlyNontaxable, 0);

  const nationalPension = Math.min(
    taxableMonthlyBase,
    RATES.nationalPensionMaxBase
  ) * RATES.nationalPension;

  const healthInsurance = taxableMonthlyBase * RATES.healthInsurance;
  const longTermCare = healthInsurance * RATES.longTermCare;
  const employmentInsurance = taxableMonthlyBase * RATES.employmentInsurance;

  const socialInsuranceMonthly =
    nationalPension + healthInsurance + longTermCare + employmentInsurance;

  const annualTaxablePay = Math.max(
    (monthlyGross - monthlyNontaxable) * 12,
    0
  );
  const earnedDeduction = calcEarnedIncomeDeduction(annualTaxablePay);
  const personalDeduction = dependents * 1_500_000;
  const annualSocialInsurance = socialInsuranceMonthly * 12;

  const taxBase = Math.max(
    annualTaxablePay - earnedDeduction - personalDeduction - annualSocialInsurance,
    0
  );

  const annualIncomeTax = calcIncomeTaxAnnual(taxBase);
  const incomeTax = annualIncomeTax / 12;
  const localTax = incomeTax * 0.1;

  const totalDeduction =
    socialInsuranceMonthly + incomeTax + localTax;
  const monthlyNet = monthlyGross - totalDeduction;

  return {
    monthlyGross,
    monthlyNet,
    annualNet: monthlyNet * 12,
    totalDeduction,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localTax,
  };
}

function render() {
  const annualSalary = formatInput(els.salary);
  const monthlyNontaxable = formatInput(els.nontaxable);
  const dependents = Number(els.dependents.value) || 1;

  const result = calculate({
    annualSalary,
    dependents,
    monthlyNontaxable,
  });

  els.monthlyNet.classList.remove("is-updating");
  void els.monthlyNet.offsetWidth;
  els.monthlyNet.classList.add("is-updating");

  els.monthlyNet.textContent = formatMoney(result.monthlyNet);
  els.annualNet.textContent = formatMoney(result.annualNet);
  els.monthlyGross.textContent = formatMoney(result.monthlyGross);
  els.totalDeduction.textContent = formatMoney(result.totalDeduction);
  els.nationalPension.textContent = formatMoney(result.nationalPension);
  els.healthInsurance.textContent = formatMoney(result.healthInsurance);
  els.longTermCare.textContent = formatMoney(result.longTermCare);
  els.employmentInsurance.textContent = formatMoney(result.employmentInsurance);
  els.incomeTax.textContent = formatMoney(result.incomeTax);
  els.localTax.textContent = formatMoney(result.localTax);
}

[els.salary, els.nontaxable].forEach((el) => {
  el.addEventListener("input", render);
  el.addEventListener("blur", render);
});

els.dependents.addEventListener("change", render);

render();
