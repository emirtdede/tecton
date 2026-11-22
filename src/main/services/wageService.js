/**
 * Wage calculation.
 *
 * Every input is numeric and comes from user-editable form fields or from DB
 * rows that may have been written before validation existed. Any one of them
 * being `undefined`, `''` or `'abc'` used to produce `NaN`, which then flowed
 * into `earned_amount` and permanently corrupted the worker balance.
 * Each input is coerced and range-checked here so callers cannot poison the DB.
 */
function toFiniteNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calculateWage({ daily_wage, multiplier, overtime_hours = 0, overtime_multiplier = 1.5, standard_hours = 8 }) {
  const wage = toFiniteNumber(daily_wage);
  const mult = toFiniteNumber(multiplier);
  const otHours = toFiniteNumber(overtime_hours);
  const otMult = toFiniteNumber(overtime_multiplier, 1.5);
  const stdHours = toFiniteNumber(standard_hours, 8);

  // A non-positive base wage or divisor cannot yield a meaningful amount.
  if (wage < 0 || mult < 0 || otHours < 0 || stdHours <= 0) {
    return 0;
  }

  const baseWage = wage * mult;
  const hourlyWage = wage / stdHours;
  const overtimeWage = hourlyWage * otMult * otHours;

  const total = baseWage + overtimeWage;
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

module.exports = { calculateWage };
