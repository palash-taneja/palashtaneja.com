(() => {
  const endpoint = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8787/subscribe'
    : 'https://palash-newsletter.tanejapalash.workers.dev/subscribe';
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
        form.reset();
      } catch (error) {
        status.textContent = error.name === 'TypeError' || error.name === 'TimeoutError'
          ? 'Couldn’t reach the newsletter service. Please try again.' : error.message;
      } finally { button.disabled = false; button.textContent = 'Subscribe'; }
    });
  });
})();
