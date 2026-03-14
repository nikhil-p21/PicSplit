export function getTaxRate(itemName) {
  const name = itemName.toLowerCase();
  if (name.includes('plastic') && name.includes('bag')) {
    return 0.10;
  }
  return 0.08;
}

export function calculateEffectiveItemTotal(item) {
  const priceBeforeTax = item.price_before_tax;
  const discount = item.discount_amount;
  const taxRate = getTaxRate(item.normalized_name);
  return (priceBeforeTax * (1 + taxRate)) - discount;
}

export function buildInitialSplitState(items, persons) {
  if (!items || items.length === 0) {
    return { allocations: {}, calculatedBillTotal: 0 };
  }

  const allocations = {};
  let calculatedBillTotal = 0;

  items.forEach(item => {
    allocations[item.normalized_name] = {
      totalQuantity: 1,
      shares: persons.reduce((acc, person) => {
        acc[person.id] = '0';
        return acc;
      }, {})
    };

    calculatedBillTotal += calculateEffectiveItemTotal(item);
  });

  return { allocations, calculatedBillTotal };
}

export function shareItemEquallyInAllocations(previousAllocations, itemName, persons) {
  const nextAllocations = { ...previousAllocations };
  if (!nextAllocations[itemName]) {
    return previousAllocations;
  }

  const equalShare = `1/${persons.length}`;
  nextAllocations[itemName] = {
    ...nextAllocations[itemName],
    shares: persons.reduce((acc, person) => {
      acc[person.id] = equalShare;
      return acc;
    }, {})
  };

  return nextAllocations;
}

export function updateAllocationShare(previousAllocations, itemName, personId, shareValue) {
  const nextAllocations = { ...previousAllocations };
  if (!nextAllocations[itemName]) {
    return previousAllocations;
  }

  nextAllocations[itemName] = {
    ...nextAllocations[itemName],
    shares: {
      ...nextAllocations[itemName].shares,
      [personId]: shareValue
    }
  };

  return nextAllocations;
}

export function updateAllocationQuantity(previousAllocations, itemName, quantity) {
  const nextAllocations = { ...previousAllocations };
  if (!nextAllocations[itemName]) {
    return previousAllocations;
  }

  const validQuantity = Math.max(1, Number(quantity) || 1);
  nextAllocations[itemName] = {
    ...nextAllocations[itemName],
    totalQuantity: validQuantity
  };

  return nextAllocations;
}

function parseShare(share) {
  const trimmedShare = String(share).trim();
  if (trimmedShare === '') {
    return { value: 0, isValid: true };
  }

  if (trimmedShare.includes('/')) {
    const parts = trimmedShare.split('/');
    if (
      parts.length === 2 &&
      !isNaN(parseFloat(parts[0])) &&
      !isNaN(parseFloat(parts[1])) &&
      parseFloat(parts[1]) !== 0
    ) {
      const value = parseFloat(parts[0]) / parseFloat(parts[1]);
      return { value, isValid: value >= 0 };
    }
    return { value: 0, isValid: false };
  }

  if (isNaN(parseFloat(trimmedShare))) {
    return { value: 0, isValid: false };
  }

  const value = parseFloat(trimmedShare);
  return { value, isValid: value >= 0 };
}

export function validateAllocations(items, allocations) {
  const errors = [];

  for (const item of items) {
    const itemName = item.normalized_name;
    const allocation = allocations[itemName];

    if (!allocation) {
      errors.push(`${itemName}: Allocation data missing.`);
      continue;
    }

    let totalShareValue = 0;
    let invalidShareFormat = false;

    for (const share of Object.values(allocation.shares)) {
      const parsed = parseShare(share);
      if (!parsed.isValid) {
        invalidShareFormat = true;
      }
      totalShareValue += parsed.value;
    }

    if (invalidShareFormat) {
      errors.push(`${itemName}: Invalid share format detected (use numbers like 0.5 or fractions like 1/2). Shares cannot be negative.`);
    } else if (Math.abs(totalShareValue - allocation.totalQuantity) > 0.001) {
      errors.push(`${itemName}: Total allocated share (${totalShareValue.toFixed(2)}) does not match item quantity (${allocation.totalQuantity}).`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function calculateSplitResults(items, allocations, persons, parseItemEmoji) {
  const personTotals = {};
  persons.forEach(person => {
    personTotals[person.id] = {
      name: person.name,
      avatarColor: person.avatarColor,
      emoji: person.emoji,
      total: 0,
      items: []
    };
  });

  items.forEach(item => {
    const itemName = item.normalized_name;
    const allocation = allocations[itemName];
    if (!allocation) {
      return;
    }

    const itemTotalCost = calculateEffectiveItemTotal(item);
    const unitCost = allocation.totalQuantity > 0 ? itemTotalCost / allocation.totalQuantity : 0;

    Object.entries(allocation.shares).forEach(([personId, share]) => {
      const { value: shareValue } = parseShare(share);
      const personCostForItem = shareValue * unitCost;

      if (personTotals[personId] && personCostForItem > 0) {
        personTotals[personId].total += personCostForItem;
        personTotals[personId].items.push({
          name: itemName,
          emoji: parseItemEmoji(itemName),
          share: shareValue,
          cost: personCostForItem
        });
      }
    });
  });

  return personTotals;
}
