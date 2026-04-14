
document.addEventListener('DOMContentLoaded', () => {
   
  const tabs  = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t  => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));

      tab.classList.add('active');
      const form = document.getElementById(`${target}-form`);
      if (form) form.classList.add('active');
    });
  });

  // ── Login Form da finire 
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(loginForm));
       
      // Ignoriamo la il login e andiamod iretti alla dashboard volendo
      console.log('[D-Vault] Login attempt:', data);
      window.location.href = 'dashboard.html';
    });
  }

  // ── Registrazione da finire 
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));

      if (data.password !== data.confirm) {
        alert('Le password non coincidono.');
        return;
      }

      console.log('[D-Vault] Register attempt:', data);
      alert('Registrazione completata! Ora puoi accedere.');
      // Passa al tab login
      document.querySelector('[data-tab="login"]')?.click();
    });
  }

  // Particles
  const container = document.getElementById('particles');
  if (container) spawnParticles(container, 25);

});
// che figo è venuto benissimo bea brava
function spawnParticles(container, count) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    const x    = Math.random() * 100;
    const size = Math.random() * 2.5 + 1;
    const dur  = Math.random() * 14 + 8;
    const del  = Math.random() * 12;

    p.style.cssText = `
      left: ${x}%;
      bottom: 0;
      width:  ${size}px;
      height: ${size}px;
      animation-duration: ${dur}s;
      animation-delay:    ${del}s;
    `;
    container.appendChild(p);
  }
}
