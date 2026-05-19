export const AudioManager = {

    bgmFire: new Audio('/audio/fire.mp3'),
    bgmCampaign: new Audio('/audio/campaign.mp3'),
    sfxClick: new Audio('/audio/click.mp3'),
    sfxHover: new Audio('/audio/hover.mp3'),

    init() {
        this.bgmFire.loop = true;
        this.bgmCampaign.loop = true;
        
        // Regola i volumi
        this.bgmFire.volume = 0.4;
        this.bgmCampaign.volume = 0.3;
        this.sfxClick.volume = 0.4;
        this.sfxHover.volume = 0.1;

        window.DVaultAudio = this;

        // Imposta i valori di default se l'utente entra per la prima volta
        if (localStorage.getItem('dvault_sfx') === null) localStorage.setItem('dvault_sfx', 'true');
        if (localStorage.getItem('dvault_bgm') === null) localStorage.setItem('dvault_bgm', 'true');

        // Suoni dei bottoni e delle interazioni
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('button, .dropdown-item, .vault-card, .tab-btn')) {
                this.playSound(this.sfxHover);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('button, .dropdown-item, .vault-card, .tab-btn')) {
                this.playSound(this.sfxClick);
            }
            // Sblocca l'audio di background al primo click dell'utente
            if (this.isBgmEnabled() && this.bgmFire.paused && this.bgmCampaign.paused) {
                this.updateBackgroundMusic(this.isInCampaign());
            }
        });

        this.updateBackgroundMusic(this.isInCampaign());
    },

    isSfxEnabled() {
        return localStorage.getItem('dvault_sfx') === 'true';
    },

    isBgmEnabled() {
        return localStorage.getItem('dvault_bgm') === 'true';
    },

    isInCampaign() {
        const campDetail = document.getElementById('campaign-detail');
        const playerCamp = document.getElementById('player-campaign-detail');
        return (campDetail && campDetail.style.display === 'block') || 
               (playerCamp && playerCamp.style.display === 'block');
    },

    playSound(audioElement) {
        if (this.isSfxEnabled()) {
            audioElement.currentTime = 0; 
            audioElement.play().catch(() => {}); 
        }
    },

    updateBackgroundMusic(inCampaign = false) {
        if (!this.isBgmEnabled()) {
            this.bgmFire.pause();
            this.bgmCampaign.pause();
            return;
        }

        if (inCampaign) {
            this.bgmFire.pause();
            this.bgmCampaign.play().catch(() => {});
        } else {
            this.bgmCampaign.pause();
            this.bgmFire.play().catch(() => {});
        }
    },

    toggleSfx(enabled) {
        localStorage.setItem('dvault_sfx', enabled);
    },

    toggleBgm(enabled) {
        localStorage.setItem('dvault_bgm', enabled);
        this.updateBackgroundMusic(this.isInCampaign());
    }
};