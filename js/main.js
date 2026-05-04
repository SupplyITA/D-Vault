document.addEventListener('DOMContentLoaded', () => {
   
  const tabs  = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  // ── Gestione Tab (Intatta)
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

  // ── Login Form Collegato al Server Node.js
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Estrae automaticamente i dati dal form in base agli attributi "name"
      const data = Object.fromEntries(new FormData(loginForm));
       
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data) // Manda identifier e password al server
        });

        const result = await response.json();

        if (response.ok) {
          // Salviamo il vero username restituito dal server per la dashboard
          localStorage.setItem('dvault_username', result.username);
          
          // Entriamo nella taverna!
          window.location.href = 'dashboard.html';
        } else {
          // Se il server dice "Credenziali errate", mostriamo il popup
          alert(result.message); 
        }
      } catch (error) {
        console.error("[D-Vault] Errore di login:", error);
        alert("Il server è spento o non raggiungibile!");
      }
    });
  }

  // ── Registrazione Collegata al Server Node.js
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));

      // Il tuo controllo di sicurezza: perfetto!
      if (data.password !== data.confirm) {
        alert('Le password non coincidono.');
        return;
      }

      try {
        const response = await fetch('/api/registrati', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data) // Manda username, email e password
        });

        const result = await response.json();

        if (response.ok) {
          alert('Registrazione completata! Ora puoi accedere.');
          registerForm.reset(); // Pulisce i campi di testo
          // La tua genialata per cambiare automaticamente tab:
          document.querySelector('[data-tab="login"]')?.click();
        } else {
          // Se il server dice "Email o Username già in uso", lo mostriamo
          alert(result.message);
        }
      } catch (error) {
        console.error("[D-Vault] Errore di registrazione:", error);
        alert("Il server è spento o non raggiungibile!");
      }
    });
  }

  // Particles (Intatto)
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