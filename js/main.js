document.addEventListener('DOMContentLoaded', () => {
   
  const tabs  = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  //  Gestione Tab (Intatta)
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
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          // Salviamo il vero username restituito dal server per la dashboard
          localStorage.setItem('dvault_username', result.username);
          
          Swal.fire({
            title: 'Bentornato, Eroe!',
            text: 'I cancelli del Vault si aprono per te.',
            icon: 'success',
            timer: 1500, 
            showConfirmButton: false,
            customClass: {
                popup: 'vault-popup'
            }
          }).then(() => {
            window.location.href = 'dashboard.html';
          });
          
        } else {
          // Credenziali errate
          Swal.fire({
            title: 'Accesso Negato',
            text: result.message,
            icon: 'error',
            customClass: {
                popup: 'vault-popup'
            },
            confirmButtonColor: '#8b1a1a',
            confirmButtonText: 'Riprova'
          }); 
        }
      } catch (error) {
        console.error("[D-Vault] Errore di login:", error);
        Swal.fire({
            title: 'Server Irraggiungibile',
            text: 'La magia del server è debole in questo momento. Riprova più tardi.',
            icon: 'warning',
            customClass: {
                popup: 'vault-popup'
            }
        });
      }
    });
  }
  // Registrazione Collegata al Server Node.js
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));

      //  Controllo validazione Email
      if (data.email !== data.confirmEmail) {
        Swal.fire({
            title: 'Errore Magico',
            text: 'Le email non coincidono. Controlla la pergamena!',
            icon: 'error',
            customClass: { popup: 'vault-popup' },
            confirmButtonColor: '#8b1a1a'
        });
        return;
      }

      // Controllo validazione Password (elegante con SweetAlert2)
      if (data.password !== data.confirm) {
        Swal.fire({
            title: 'Errore Magico',
            text: 'Le password non coincidono. Riprova l\'incantesimo.',
            icon: 'error',
            customClass: { popup: 'vault-popup' },
            confirmButtonColor: '#8b1a1a'
        });
        return;
      }

      try {
        const response = await fetch('/api/registrati', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data) 
        });

        const result = await response.json();

        if (response.ok) {
          Swal.fire({
            title: 'Evocazione Riuscita!',
            text: 'Il tuo account è stato creato. Ora puoi accedere.',
            icon: 'success',
            customClass: { popup: 'vault-popup' }
          }).then(() => {
            registerForm.reset(); 
            document.querySelector('[data-tab="login"]')?.click();
          });
        } else {
          // per controllare se email è già in uso (o altri errori)
          Swal.fire({
            title: 'Nome Ghiacciato',
            text: result.message,
            icon: 'warning',
            customClass: { popup: 'vault-popup' },
            confirmButtonColor: '#e8c97e'
          });
        }
      } catch (error) {
        console.error("[D-Vault] Errore di registrazione:", error);
        Swal.fire({
            title: 'Server Irraggiungibile',
            text: 'La taverna è chiusa. Riprova più tardi.',
            icon: 'warning',
            customClass: { popup: 'vault-popup' },
            confirmButtonColor: '#4a90e2'
        });
      }
    });
  }

  // Gestione "Password Dimenticata"
  const forgotLink = document.getElementById('forgot-link');
  const backToLogin = document.getElementById('back-to-login');
  const resetForm = document.getElementById('reset-form');

  // Cambia schermata per mostrare il recupero
  if (forgotLink && backToLogin && resetForm && loginForm) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      resetForm.classList.add('active');
    });

    // Torna indietro al login
    backToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      resetForm.classList.remove('active');
      loginForm.classList.add('active');
    });
  }

  // Invio dei dati al server per cambiare password
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(resetForm));

      try {
        const response = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          Swal.fire({
            title: 'Memoria Ripristinata!',
            text: result.message,
            icon: 'success',
            customClass: {
                popup: 'vault-popup'
            },
            confirmButtonColor: '#4a90e2'
          }).then(() => {
            resetForm.reset();
            backToLogin.click();
          });
        } else {
          Swal.fire({
            title: 'Pergamena Vuota',
            text: result.message,
            icon: 'error',
            customClass: {
                popup: 'vault-popup'
            },
            confirmButtonColor: '#8b1a1a'
          });
        }
      } catch (error) {
        console.error("[D-Vault] Errore reset:", error);
        Swal.fire({
            title: 'Server Irraggiungibile',
            text: 'I corvi hanno rubato il tuo messaggio. Riprova.',
            icon: 'warning',
            customClass: {
                popup: 'vault-popup'
            },
            confirmButtonColor: '#4a90e2'
        });
      }
    });
  }

  // Particles (Intatto)
  const container = document.getElementById('particles');
  if (container) spawnParticles(container, 25);

});

// Funzione per particelle random 
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