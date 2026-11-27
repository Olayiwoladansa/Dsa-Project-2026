
export function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'text') {
      element.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in element) {
      element[key] = value;
    } else {
      element.setAttribute(key, value);
    }
  }

  const items = Array.isArray(children) ? children : [children];

  for (const child of items) {
    if (child === null || child === undefined) continue;

    element.append(
      typeof child === 'string'
        ? document.createTextNode(child)
        : child
    );
  }

  return element;
}

export function formatMoney(priceCents) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
