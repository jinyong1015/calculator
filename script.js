/**
 * PAYNET 계산기
 * 기준: 2025년 4대보험 요율 + 간이 소득세 추정
 */

const RATES = {
  nationalPension: 0.045,
  nationalPensionMaxBase: 6_370_000,
  healthInsurance: 0.03545,
  longTermCare: 0.1295,
  employmentInsurance: 0.009,
  employerEmploymentInsurance: 0.0115, // 실업급여 등 회사 부담 대략치
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

const WEEKS_PER_MONTH = 4.345;

function parseMoney(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatMoney(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatNumber(value, suffix = "") {
  return `${Math.round(value).toLocaleString("ko-KR")}${suffix}`;
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

function calcSocialInsurance(monthlyBase) {
  const base = Math.max(monthlyBase, 0);
  const pensionBase = Math.min(base, RATES.nationalPensionMaxBase);

  const nationalPension = pensionBase * RATES.nationalPension;
  const healthInsurance = base * RATES.healthInsurance;
  const longTermCare = healthInsurance * RATES.longTermCare;
  const employmentInsurance = base * RATES.employmentInsurance;

  const employeeTotal =
    nationalPension + healthInsurance + longTermCare + employmentInsurance;

  const employerNationalPension = nationalPension;
  const employerHealth = healthInsurance + longTermCare;
  const employerEmployment = base * RATES.employerEmploymentInsurance;
  const employerTotal =
    employerNationalPension + employerHealth + employerEmployment;

  return {
    base,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    employeeTotal,
    employerNationalPension,
    employerHealth,
    employerEmployment,
    employerTotal,
    grandTotal: employeeTotal + employerTotal,
  };
}

function calculatePay({ annualSalary, dependents, monthlyNontaxable }) {
  const monthlyGross = annualSalary / 12;
  const taxableMonthlyBase = Math.max(monthlyGross - monthlyNontaxable, 0);
  const insurance = calcSocialInsurance(taxableMonthlyBase);

  const annualTaxablePay = taxableMonthlyBase * 12;
  const earnedDeduction = calcEarnedIncomeDeduction(annualTaxablePay);
  const personalDeduction = dependents * 1_500_000;
  const annualSocialInsurance = insurance.employeeTotal * 12;

  const taxBase = Math.max(
    annualTaxablePay - earnedDeduction - personalDeduction - annualSocialInsurance,
    0
  );

  const annualIncomeTax = calcIncomeTaxAnnual(taxBase);
  const incomeTax = annualIncomeTax / 12;
  const localTax = incomeTax * 0.1;
  const annualLocalTax = localTax * 12;

  const totalDeduction = insurance.employeeTotal + incomeTax + localTax;
  const monthlyNet = monthlyGross - totalDeduction;
  const annualTaxTotal = annualIncomeTax + annualLocalTax;
  const effectiveRate =
    annualSalary > 0 ? (annualTaxTotal / annualSalary) * 100 : 0;

  return {
    monthlyGross,
    monthlyNet,
    annualNet: monthlyNet * 12,
    totalDeduction,
    nationalPension: insurance.nationalPension,
    healthInsurance: insurance.healthInsurance,
    longTermCare: insurance.longTermCare,
    employmentInsurance: insurance.employmentInsurance,
    incomeTax,
    localTax,
    annualIncomeTax,
    annualLocalTax,
    taxBase,
    earnedDeduction,
    personalDeduction,
    effectiveRate,
    insurance,
  };
}

/* ---------- DOM refs ---------- */

const netEls = {
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

const taxEls = {
  salary: document.getElementById("taxSalary"),
  dependents: document.getElementById("taxDependents"),
  nontaxable: document.getElementById("taxNontaxable"),
  monthlyIncome: document.getElementById("taxMonthlyIncome"),
  monthlyTotal: document.getElementById("taxMonthlyTotal"),
  annualIncome: document.getElementById("taxAnnualIncome"),
  annualLocal: document.getElementById("taxAnnualLocal"),
  taxBase: document.getElementById("taxBase"),
  earnedDeduction: document.getElementById("taxEarnedDeduction"),
  personalDeduction: document.getElementById("taxPersonalDeduction"),
  effectiveRate: document.getElementById("taxEffectiveRate"),
};

const insureEls = {
  salary: document.getElementById("insureSalary"),
  nontaxable: document.getElementById("insureNontaxable"),
  employeeTotal: document.getElementById("insureEmployeeTotal"),
  employerTotal: document.getElementById("insureEmployerTotal"),
  base: document.getElementById("insureBase"),
  grandTotal: document.getElementById("insureGrandTotal"),
  np: document.getElementById("insureNP"),
  hi: document.getElementById("insureHI"),
  ltc: document.getElementById("insureLTC"),
  ei: document.getElementById("insureEI"),
  npCompany: document.getElementById("insureNPCompany"),
  healthCompany: document.getElementById("insureHealthCompany"),
  eiCompany: document.getElementById("insureEICompany"),
};

const hourlyEls = {
  wage: document.getElementById("hourlyWage"),
  hoursPerDay: document.getElementById("hoursPerDay"),
  daysPerWeek: document.getElementById("daysPerWeek"),
  weeklyHoliday: document.getElementById("includeWeeklyHoliday"),
  monthly: document.getElementById("monthlyForHourly"),
  monthlyHours: document.getElementById("monthlyHours"),
  toSalaryFields: document.getElementById("hourlyToSalaryFields"),
  toHourlyFields: document.getElementById("hourlyToHourlyFields"),
  resultTitle: document.getElementById("hourlyResultTitle"),
  mainResult: document.getElementById("hourlyMainResult"),
  subResult: document.getElementById("hourlySubResult"),
  summaryLabel1: document.getElementById("hourlySummaryLabel1"),
  summaryValue1: document.getElementById("hourlySummaryValue1"),
  summaryLabel2: document.getElementById("hourlySummaryLabel2"),
  summaryValue2: document.getElementById("hourlySummaryValue2"),
  detailLabel1: document.getElementById("hourlyDetailLabel1"),
  detailValue1: document.getElementById("hourlyDetailValue1"),
  detailLabel2: document.getElementById("hourlyDetailLabel2"),
  detailValue2: document.getElementById("hourlyDetailValue2"),
  detailLabel3: document.getElementById("hourlyDetailLabel3"),
  detailValue3: document.getElementById("hourlyDetailValue3"),
};

let hourlyMode = "toSalary";

function pulse(el) {
  if (!el) return;
  el.classList.remove("is-updating");
  void el.offsetWidth;
  el.classList.add("is-updating");
}

function renderNet() {
  const annualSalary = formatInput(netEls.salary);
  const monthlyNontaxable = formatInput(netEls.nontaxable);
  const dependents = Number(netEls.dependents.value) || 1;
  const result = calculatePay({ annualSalary, dependents, monthlyNontaxable });

  pulse(netEls.monthlyNet);
  netEls.monthlyNet.textContent = formatMoney(result.monthlyNet);
  netEls.annualNet.textContent = formatMoney(result.annualNet);
  netEls.monthlyGross.textContent = formatMoney(result.monthlyGross);
  netEls.totalDeduction.textContent = formatMoney(result.totalDeduction);
  netEls.nationalPension.textContent = formatMoney(result.nationalPension);
  netEls.healthInsurance.textContent = formatMoney(result.healthInsurance);
  netEls.longTermCare.textContent = formatMoney(result.longTermCare);
  netEls.employmentInsurance.textContent = formatMoney(
    result.employmentInsurance
  );
  netEls.incomeTax.textContent = formatMoney(result.incomeTax);
  netEls.localTax.textContent = formatMoney(result.localTax);
}

function renderTax() {
  const annualSalary = formatInput(taxEls.salary);
  const monthlyNontaxable = formatInput(taxEls.nontaxable);
  const dependents = Number(taxEls.dependents.value) || 1;
  const result = calculatePay({ annualSalary, dependents, monthlyNontaxable });

  pulse(taxEls.monthlyIncome);
  taxEls.monthlyIncome.textContent = formatMoney(result.incomeTax);
  taxEls.monthlyTotal.textContent = formatMoney(
    result.incomeTax + result.localTax
  );
  taxEls.annualIncome.textContent = formatMoney(result.annualIncomeTax);
  taxEls.annualLocal.textContent = formatMoney(result.annualLocalTax);
  taxEls.taxBase.textContent = formatMoney(result.taxBase);
  taxEls.earnedDeduction.textContent = formatMoney(result.earnedDeduction);
  taxEls.personalDeduction.textContent = formatMoney(result.personalDeduction);
  taxEls.effectiveRate.textContent = `${result.effectiveRate.toFixed(2)}%`;
}

function renderInsure() {
  const monthlySalary = formatInput(insureEls.salary);
  const monthlyNontaxable = formatInput(insureEls.nontaxable);
  const base = Math.max(monthlySalary - monthlyNontaxable, 0);
  const insurance = calcSocialInsurance(base);

  pulse(insureEls.employeeTotal);
  insureEls.employeeTotal.textContent = formatMoney(insurance.employeeTotal);
  insureEls.employerTotal.textContent = formatMoney(insurance.employerTotal);
  insureEls.base.textContent = formatMoney(insurance.base);
  insureEls.grandTotal.textContent = formatMoney(insurance.grandTotal);
  insureEls.np.textContent = formatMoney(insurance.nationalPension);
  insureEls.hi.textContent = formatMoney(insurance.healthInsurance);
  insureEls.ltc.textContent = formatMoney(insurance.longTermCare);
  insureEls.ei.textContent = formatMoney(insurance.employmentInsurance);
  insureEls.npCompany.textContent = formatMoney(
    insurance.employerNationalPension
  );
  insureEls.healthCompany.textContent = formatMoney(insurance.employerHealth);
  insureEls.eiCompany.textContent = formatMoney(insurance.employerEmployment);
}

function renderHourly() {
  if (hourlyMode === "toSalary") {
    const wage = formatInput(hourlyEls.wage);
    const hoursPerDay = Number(hourlyEls.hoursPerDay.value) || 0;
    const daysPerWeek = Number(hourlyEls.daysPerWeek.value) || 0;
    const includeHoliday = hourlyEls.weeklyHoliday.value === "yes";

    const weeklyWorkHours = hoursPerDay * daysPerWeek;
    const weeklyHolidayHours =
      includeHoliday && weeklyWorkHours >= 15 ? hoursPerDay : 0;
    const weeklyPay = wage * (weeklyWorkHours + weeklyHolidayHours);
    const monthlyBase = wage * weeklyWorkHours * WEEKS_PER_MONTH;
    const monthlyHoliday = wage * weeklyHolidayHours * WEEKS_PER_MONTH;
    const monthlyTotal = monthlyBase + monthlyHoliday;
    const monthlyHours =
      (weeklyWorkHours + weeklyHolidayHours) * WEEKS_PER_MONTH;

    pulse(hourlyEls.mainResult);
    hourlyEls.resultTitle.textContent = "예상 월급";
    hourlyEls.mainResult.textContent = formatMoney(monthlyTotal);
    hourlyEls.subResult.innerHTML = `연봉 환산 <strong>${formatMoney(
      monthlyTotal * 12
    )}</strong>`;
    hourlyEls.summaryLabel1.textContent = "주급";
    hourlyEls.summaryValue1.textContent = formatMoney(weeklyPay);
    hourlyEls.summaryLabel2.textContent = "월 근로시간(환산)";
    hourlyEls.summaryValue2.textContent = formatNumber(monthlyHours, "시간");
    hourlyEls.detailLabel1.textContent = "기본급 (월)";
    hourlyEls.detailValue1.textContent = formatMoney(monthlyBase);
    hourlyEls.detailLabel2.textContent = "주휴수당 (월)";
    hourlyEls.detailValue2.textContent = formatMoney(monthlyHoliday);
    hourlyEls.detailLabel3.textContent = "시급";
    hourlyEls.detailValue3.textContent = formatMoney(wage);
    return;
  }

  const monthly = formatInput(hourlyEls.monthly);
  const monthlyHours = Number(hourlyEls.monthlyHours.value) || 1;
  const wage = monthly / monthlyHours;

  pulse(hourlyEls.mainResult);
  hourlyEls.resultTitle.textContent = "환산 시급";
  hourlyEls.mainResult.textContent = formatMoney(wage);
  hourlyEls.subResult.innerHTML = `연봉 환산 <strong>${formatMoney(
    monthly * 12
  )}</strong>`;
  hourlyEls.summaryLabel1.textContent = "월급";
  hourlyEls.summaryValue1.textContent = formatMoney(monthly);
  hourlyEls.summaryLabel2.textContent = "월 기준 근로시간";
  hourlyEls.summaryValue2.textContent = formatNumber(monthlyHours, "시간");
  hourlyEls.detailLabel1.textContent = "일급 (8시간 가정)";
  hourlyEls.detailValue1.textContent = formatMoney(wage * 8);
  hourlyEls.detailLabel2.textContent = "주급 (40시간 가정)";
  hourlyEls.detailValue2.textContent = formatMoney(wage * 40);
  hourlyEls.detailLabel3.textContent = "시급";
  hourlyEls.detailValue3.textContent = formatMoney(wage);
}

function bindMoneyInputs(elements, handler) {
  elements.forEach((el) => {
    if (!el) return;
    el.addEventListener("input", handler);
    el.addEventListener("blur", handler);
  });
}

function bindChange(elements, handler) {
  elements.forEach((el) => {
    if (!el) return;
    el.addEventListener("change", handler);
    el.addEventListener("input", handler);
  });
}

/* ---------- 부동산: 중개수수료 ---------- */

function calcBrokerFee(price, deal, type) {
  if (price <= 0) {
    return { fee: 0, rate: 0, cap: Infinity };
  }

  if (type === "other") {
    return { fee: price * 0.009, rate: 0.9, cap: Infinity };
  }

  // 주택 상한 요율 (매매 / 임대차)
  const saleBrackets = [
    { limit: 50_000_000, rate: 0.006, max: 250_000 },
    { limit: 200_000_000, rate: 0.005, max: 800_000 },
    { limit: 900_000_000, rate: 0.004, max: Infinity },
    { limit: 1_200_000_000, rate: 0.005, max: Infinity },
    { limit: 1_500_000_000, rate: 0.006, max: Infinity },
    { limit: Infinity, rate: 0.007, max: Infinity },
  ];

  const rentBrackets = [
    { limit: 50_000_000, rate: 0.005, max: 200_000 },
    { limit: 100_000_000, rate: 0.004, max: 300_000 },
    { limit: 900_000_000, rate: 0.003, max: Infinity },
    { limit: 1_200_000_000, rate: 0.004, max: Infinity },
    { limit: 1_500_000_000, rate: 0.005, max: Infinity },
    { limit: Infinity, rate: 0.006, max: Infinity },
  ];

  const brackets = deal === "rent" ? rentBrackets : saleBrackets;
  for (const b of brackets) {
    if (price <= b.limit) {
      const raw = price * b.rate;
      const fee = Math.min(raw, b.max);
      return { fee, rate: b.rate * 100, cap: b.max };
    }
  }
  return { fee: 0, rate: 0, cap: Infinity };
}

const brokerEls = {
  price: document.getElementById("brokerPrice"),
  deal: document.getElementById("brokerDeal"),
  type: document.getElementById("brokerType"),
  vat: document.getElementById("brokerVat"),
  fee: document.getElementById("brokerFee"),
  feeVat: document.getElementById("brokerFeeVat"),
  rate: document.getElementById("brokerRate"),
  dealAmount: document.getElementById("brokerDealAmount"),
  cap: document.getElementById("brokerCap"),
  vatAmount: document.getElementById("brokerVatAmount"),
  total: document.getElementById("brokerTotal"),
};

function renderBroker() {
  const price = formatInput(brokerEls.price);
  const { fee, rate, cap } = calcBrokerFee(
    price,
    brokerEls.deal.value,
    brokerEls.type.value
  );
  const vat = fee * 0.1;
  const total = fee + vat;

  pulse(brokerEls.fee);
  brokerEls.fee.textContent = formatMoney(fee);
  brokerEls.feeVat.textContent = formatMoney(total);
  brokerEls.rate.textContent = `${rate.toFixed(1)}%`;
  brokerEls.dealAmount.textContent = formatMoney(price);
  brokerEls.cap.textContent =
    cap === Infinity ? "한도 없음(요율 적용)" : formatMoney(cap);
  brokerEls.vatAmount.textContent = formatMoney(vat);
  brokerEls.total.textContent = formatMoney(total);
}

/* ---------- 부동산: 양도소득세 ---------- */

function longTermDeductionRate(years, homes) {
  if (years < 3) return 0;
  if (homes >= 2) {
    // 다주택 단순화: 연 4%, 최대 30% 수준 참고
    return Math.min(0.3, (years - 2) * 0.04);
  }
  // 1주택 단순화: 연 8%, 최대 80% 수준 참고
  return Math.min(0.8, years * 0.08);
}

const cgtEls = {
  sell: document.getElementById("cgtSell"),
  buy: document.getElementById("cgtBuy"),
  expense: document.getElementById("cgtExpense"),
  years: document.getElementById("cgtYears"),
  homes: document.getElementById("cgtHomes"),
  exempt: document.getElementById("cgtExempt"),
  tax: document.getElementById("cgtTax"),
  taxTotal: document.getElementById("cgtTaxTotal"),
  gain: document.getElementById("cgtGain"),
  base: document.getElementById("cgtBase"),
  longDeduction: document.getElementById("cgtLongDeduction"),
  basicDeduction: document.getElementById("cgtBasicDeduction"),
  incomeTax: document.getElementById("cgtIncomeTax"),
  localTax: document.getElementById("cgtLocalTax"),
};

function renderCgt() {
  const sell = formatInput(cgtEls.sell);
  const buy = formatInput(cgtEls.buy);
  const expense = formatInput(cgtEls.expense);
  const years = Number(cgtEls.years.value) || 0;
  const homes = Number(cgtEls.homes.value) || 1;
  const exempt = cgtEls.exempt.value === "yes" && homes === 1;

  const gain = Math.max(sell - buy - expense, 0);
  const longRate = longTermDeductionRate(years, homes);
  const longDeduction = gain * longRate;
  const basicDeduction = exempt ? 0 : 2_500_000;
  const taxBase = exempt
    ? 0
    : Math.max(gain - longDeduction - basicDeduction, 0);
  const incomeTax = exempt ? 0 : calcIncomeTaxAnnual(taxBase);
  const localTax = incomeTax * 0.1;

  pulse(cgtEls.tax);
  cgtEls.tax.textContent = formatMoney(incomeTax);
  cgtEls.taxTotal.textContent = formatMoney(incomeTax + localTax);
  cgtEls.gain.textContent = formatMoney(gain);
  cgtEls.base.textContent = formatMoney(taxBase);
  cgtEls.longDeduction.textContent = formatMoney(longDeduction);
  cgtEls.basicDeduction.textContent = formatMoney(basicDeduction);
  cgtEls.incomeTax.textContent = formatMoney(incomeTax);
  cgtEls.localTax.textContent = formatMoney(localTax);
}

/* ---------- 부동산: 대출이자 ---------- */

function calcLoan(principal, annualRatePercent, years, method) {
  const months = Math.max(Math.round(years * 12), 1);
  const monthlyRate = annualRatePercent / 100 / 12;

  if (principal <= 0) {
    return {
      months,
      monthly: 0,
      totalInterest: 0,
      totalPay: 0,
      firstInterest: 0,
      firstPrincipal: 0,
    };
  }

  if (method === "bullet") {
    const monthlyInterest = principal * monthlyRate;
    const totalInterest = monthlyInterest * months;
    return {
      months,
      monthly: monthlyInterest,
      totalInterest,
      totalPay: principal + totalInterest,
      firstInterest: monthlyInterest,
      firstPrincipal: 0,
      label: "월 이자",
    };
  }

  if (method === "equalPrincipal") {
    const principalPart = principal / months;
    let balance = principal;
    let totalInterest = 0;
    const firstInterest = balance * monthlyRate;
    for (let i = 0; i < months; i += 1) {
      totalInterest += balance * monthlyRate;
      balance -= principalPart;
    }
    return {
      months,
      monthly: principalPart + firstInterest,
      totalInterest,
      totalPay: principal + totalInterest,
      firstInterest,
      firstPrincipal: principalPart,
      label: "첫 달 상환액",
    };
  }

  // 원리금균등
  let monthly;
  if (monthlyRate === 0) {
    monthly = principal / months;
  } else {
    const factor = Math.pow(1 + monthlyRate, months);
    monthly = (principal * monthlyRate * factor) / (factor - 1);
  }
  const totalPay = monthly * months;
  const totalInterest = totalPay - principal;
  const firstInterest = principal * monthlyRate;
  const firstPrincipal = monthly - firstInterest;

  return {
    months,
    monthly,
    totalInterest,
    totalPay,
    firstInterest,
    firstPrincipal,
    label: "월 상환액",
  };
}

const loanEls = {
  principal: document.getElementById("loanPrincipal"),
  rate: document.getElementById("loanRate"),
  years: document.getElementById("loanYears"),
  method: document.getElementById("loanMethod"),
  resultTitle: document.getElementById("loanResultTitle"),
  monthly: document.getElementById("loanMonthly"),
  totalInterest: document.getElementById("loanTotalInterest"),
  totalPay: document.getElementById("loanTotalPay"),
  months: document.getElementById("loanMonths"),
  firstInterest: document.getElementById("loanFirstInterest"),
  firstPrincipal: document.getElementById("loanFirstPrincipal"),
  principalOut: document.getElementById("loanPrincipalOut"),
};

function renderLoan() {
  const principal = formatInput(loanEls.principal);
  const rate = Number(loanEls.rate.value) || 0;
  const years = Number(loanEls.years.value) || 1;
  const result = calcLoan(principal, rate, years, loanEls.method.value);

  pulse(loanEls.monthly);
  loanEls.resultTitle.textContent = result.label || "월 상환액";
  loanEls.monthly.textContent = formatMoney(result.monthly);
  loanEls.totalInterest.textContent = formatMoney(result.totalInterest);
  loanEls.totalPay.textContent = formatMoney(result.totalPay);
  loanEls.months.textContent = `${result.months}회`;
  loanEls.firstInterest.textContent = formatMoney(result.firstInterest);
  loanEls.firstPrincipal.textContent = formatMoney(result.firstPrincipal);
  loanEls.principalOut.textContent = formatMoney(principal);
}

/* ---------- Tabs / Category ---------- */

const SALARY_TABS = ["net", "tax", "insure", "hourly"];
const ESTATE_TABS = ["broker", "cgt", "loan"];

function switchCategory(category) {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    const active = btn.dataset.category === category;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll("[data-category-panel]").forEach((el) => {
    el.hidden = el.dataset.categoryPanel !== category;
  });

  const defaultTab = category === "estate" ? "broker" : "net";
  switchTab(defaultTab);
}

function switchTab(tabId) {
  const category = ESTATE_TABS.includes(tabId) ? "estate" : "salary";

  document.querySelectorAll(".category-btn").forEach((btn) => {
    const active = btn.dataset.category === category;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-category-panel]").forEach((el) => {
    el.hidden = el.dataset.categoryPanel !== category;
  });

  document.querySelectorAll(".calc-tab").forEach((tab) => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".calc-panel").forEach((panel) => {
    const active = panel.id === `panel-${tabId}`;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

document.querySelectorAll(".category-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchCategory(btn.dataset.category));
});

document.querySelectorAll(".calc-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.querySelectorAll("[data-hourly-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    hourlyMode = btn.dataset.hourlyMode;
    document.querySelectorAll("[data-hourly-mode]").forEach((el) => {
      el.classList.toggle("is-active", el === btn);
    });
    hourlyEls.toSalaryFields.hidden = hourlyMode !== "toSalary";
    hourlyEls.toHourlyFields.hidden = hourlyMode !== "toHourly";
    renderHourly();
  });
});

bindMoneyInputs([netEls.salary, netEls.nontaxable], renderNet);
bindChange([netEls.dependents], renderNet);

bindMoneyInputs([taxEls.salary, taxEls.nontaxable], renderTax);
bindChange([taxEls.dependents], renderTax);

bindMoneyInputs([insureEls.salary, insureEls.nontaxable], renderInsure);

bindMoneyInputs([hourlyEls.wage, hourlyEls.monthly], renderHourly);
bindChange(
  [
    hourlyEls.hoursPerDay,
    hourlyEls.daysPerWeek,
    hourlyEls.weeklyHoliday,
    hourlyEls.monthlyHours,
  ],
  renderHourly
);

bindMoneyInputs([brokerEls.price], renderBroker);
bindChange([brokerEls.deal, brokerEls.type, brokerEls.vat], renderBroker);

bindMoneyInputs([cgtEls.sell, cgtEls.buy, cgtEls.expense], renderCgt);
bindChange([cgtEls.years, cgtEls.homes, cgtEls.exempt], renderCgt);

bindMoneyInputs([loanEls.principal], renderLoan);
bindChange([loanEls.rate, loanEls.years, loanEls.method], renderLoan);

renderNet();
renderTax();
renderInsure();
renderHourly();
renderBroker();
renderCgt();
renderLoan();

const hash = window.location.hash.replace("#", "");
if ([...SALARY_TABS, ...ESTATE_TABS].includes(hash)) {
  switchTab(hash);
} else if (hash === "tools" || hash === "estate") {
  switchCategory(hash === "estate" ? "estate" : "salary");
}
