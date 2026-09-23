(() => {
  const endpoint = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8787/subscribe'
    : 'https://palash-newsletter.tanejapalash.workers.dev/subscribe';
  const bites = document.querySelector('[data-pizza-bites]');
  async function eatPizza() {
    if (!bites) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const positions = [[219, 207], [152, 233], [77, 206], [42, 134], [79, 60]];
    if (!reducedMotion) {
      for (const [x, y] of [...positions, [145, 42], [216, 77], [234, 143], [140, 140]]) {
        // Overlapping circles leave a scalloped, tooth-shaped bite in the silhouette.
        for (const [dx, dy] of [[-19, -11], [18, -10], [0, 20]]) {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', x + dx);
          circle.setAttribute('cy', y + dy);
          circle.setAttribute('r', '40');
          bites.append(circle);
        }
        await new Promise(resolve => setTimeout(resolve, 230));
      }
    }
    const gone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gone.setAttribute('width', '280');
    gone.setAttribute('height', '280');
    bites.append(gone);
    bites.closest('figure').setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('[data-newsletter-form]').forEach(form => {
    const button = form.querySelector('button');
    const status = form.querySelector('[role="status"]');
    button.disabled = false
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Joining…';
      status.textContent = '';
      bites?.replaceChildren();
      bites?.closest('figure').removeAttribute('aria-hidden');
      const email = form.elements.email.value.trim().toLowerCase();
      try {
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ email, website: form.elements.website.value, consent: true, source: location.pathname }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Please try again later.');
        status.textContent = `Thanks! Your signup for ${email} has been received.`;
        button.textContent = 'Subscribed!';
        form.reset();
        await eatPizza();
      } catch (error) {
        status.textContent = error.name === 'TypeError' || error.name === 'TimeoutError'
          ? 'Couldn’t reach the newsletter service. Please try again.' : error.message;
      } finally { button.disabled = false; button.textContent = 'Subscribe'; }
    });
  });
})();
