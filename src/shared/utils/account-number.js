function calculateLuhnCheckDigit(baseDigits) {
  let sum = 0;
  let shouldDouble = true;

  for (let index = baseDigits.length - 1; index >= 0; index -= 1) {
    let digit = Number(baseDigits[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

function generateAccountNumber() {
  const baseDigits = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
  const checkDigit = calculateLuhnCheckDigit(baseDigits);
  return `${baseDigits}${checkDigit}`;
}

function isValidAccountNumber(value) {
  if (!/^\d{10}$/.test(value)) {
    return false;
  }

  const baseDigits = value.slice(0, -1);
  return Number(value.slice(-1)) === calculateLuhnCheckDigit(baseDigits);
}

module.exports = {
  generateAccountNumber,
  isValidAccountNumber,
};
