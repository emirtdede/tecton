function calculateWage({ daily_wage, multiplier, overtime_hours = 0, overtime_multiplier = 1.5, standard_hours = 8 }) {
  for (const [k, v] of Object.entries({ daily_wage, multiplier, overtime_hours, overtime_multiplier, standard_hours })) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`invalid_input:${k}`);
    }
  }
  if (daily_wage < 0 || multiplier < 0 || overtime_hours < 0 || overtime_multiplier < 0) {
    throw new Error('invalid_input:negative');
  }
  if (standard_hours <= 0) {
    throw new Error('invalid_input:standard_hours');
  }
  const baseWage = daily_wage * multiplier;
  const hourlyWage = daily_wage / standard_hours;
  const overtimeWage = hourlyWage * overtime_multiplier * overtime_hours;

  return Number((baseWage + overtimeWage).toFixed(2));
}

module.exports = { calculateWage };
