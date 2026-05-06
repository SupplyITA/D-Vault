export const State = {
  username: localStorage.getItem('dvault_username') || 'Avventuriero',
  sheets: [],
  campaigns: [],

  async loadFromServer() {
      try {
          const resSheets = await fetch(`/api/sheets?user=${this.username}`);
          this.sheets = await resSheets.json();
          const resCamps = await fetch(`/api/campaigns?user=${this.username}`);
          this.campaigns = await resCamps.json();
      } catch (e) {
          console.error("Errore nel caricamento dal server:", e);
      }
  }
};