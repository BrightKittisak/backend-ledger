function maskFullName(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) {
        return `${part[0] || ''}*`;
      }

      return `${part[0]}${'*'.repeat(part.length - 2)}${part[part.length - 1]}`;
    })
    .join(' ');
}

function maskBankAccountNumber(value) {
  if (!value || value.length <= 4) {
    return value;
  }

  const visibleTail = value.slice(-4);
  return `${'*'.repeat(value.length - 4)}${visibleTail}`;
}

module.exports = {
  maskBankAccountNumber,
  maskFullName,
};
