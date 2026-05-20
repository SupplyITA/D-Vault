export const AudioManager = {
    // Sottofondi
    bgmFire: new Audio('/audio/fire.mp3'),
    bgmCampaign: new Audio('/audio/campaign.mp3'),
    
    sfxClick: new Audio('/audio/click.mp3'),
    sfxHover: new Audio('/audio/hover.mp3'),
    
    sfxCardHover: new Audio('/audio/card-hover.mp3'),
    sfxDelete: new Audio('/audio/delete.mp3'),
    sfxEnter: new Audio('/audio/enter.mp3'),

    init() {
        this.bgmFire.loop = true;
        this.bgmCampaign.loop = true;
        
        // Regola i volumi
        this.bgmFire.volume = 0.4;
        this.bgmCampaign.volume = 0.3;
        this.sfxClick.volume = 0.4;
        this.sfxHover.volume = 0.6;
        this.sfxCardHover.volume = 0.15; 
        this.sfxDelete.volume = 0.5;
        this.sfxEnter.volume = 0.5;

        window.DVaultAudio = this;

        if (localStorage.getItem('dvault_sfx') === null) localStorage.setItem('dvault_sfx', 'true');
        if (localStorage.getItem('dvault_bgm') === null) localStorage.setItem('dvault_bgm', 'true');

        //Gestion hover
        document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('button, .dropdown-item, .tab-btn');
            const card = e.target.closest('.vault-card');
            
            //If per evitare hover multipli
            if (btn) {
                if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
                this.playSound(this.sfxHover);
            } 
            else if (card) {
                if (e.relatedTarget && card.contains(e.relatedTarget)) return;
                this.playSound(this.sfxCardHover);
            }
        });
        
        //Gestione click bottoni differenziati
        document.addEventListener('click', (e) => {
            const t = e.target;

            if (t.closest('.btn-delete') || t.closest('.btn-leave')) {
                this.playSound(this.sfxDelete);
            } 
            else if (t.closest('.lux-btn')) {
                this.playSound(this.sfxEnter);
            } 
            else if (t.closest('button, .dropdown-item, .tab-btn')) {
                this.playSound(this.sfxClick);
            }

            //Attiva l'audio dopo il primo click
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

    toggleSfx(enabled) { localStorage.setItem('dvault_sfx', enabled); },
    toggleBgm(enabled) {
        localStorage.setItem('dvault_bgm', enabled);
        this.updateBackgroundMusic(this.isInCampaign());
    },

    changeCampaignTrack(sourceUrl) {
        const wasPlaying = !this.bgmCampaign.paused;
        this.bgmCampaign.pause();
        
        this.bgmCampaign.src = sourceUrl;
        this.bgmCampaign.load();
        
        // Se la musica era accesa o le impostazioni lo permettono, falla partire
        if (this.isBgmEnabled()) {
            this.bgmCampaign.play().catch(() => {});
        }
    }
};