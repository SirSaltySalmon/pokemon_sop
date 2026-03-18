// --- Utility Functions ---
function generateSessionId() {
    return 'sess-' + Math.random().toString(36).slice(2, 9);
}
function getSessionIdFromStorage() {
    const stored = localStorage.getItem('characterVotingStats');
    if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // If corrupted, clear and return default
          localStorage.removeItem('characterVotingStats');
        }
      }
    return generateSessionId();
}
function getUserStatsFromStorage() {
    const stored = localStorage.getItem('characterVotingStats');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // If corrupted, clear and return default
        localStorage.removeItem('characterVotingStats');
      }
    }
    // Default stats
    return {
      majorityStreak: 0,
      minorityStreak: 0,
      majorityTotal: 0,
      minorityTotal: 0,
      yesVotesTotal: 0,
      noVotesTotal: 0,
      skipsTotal: 0,
      majorityPoints: 0,
      minorityPoints: 0,
      lastEarnedPoints: 0,
      interactedCharacters: [],
      sessionId: generateSessionId()
    };
}
function saveUserStatsToStorage(stats) {
    localStorage.setItem('characterVotingStats', JSON.stringify(stats));
}
  
// --- Tag Filter UI ---
class TagFilterManager {
    constructor() {
        this.tags = new Map(); // tag -> state ('neutral', 'included', 'excluded')
        this.allTags = [];
        this.searchTerm = '';
        this.container = document.getElementById('tagContainer');
    this.searchBox = document.getElementById('tagSearch');
    this.filterSummary = document.getElementById('filterSummary');
    this.filterOutput = document.getElementById('filterOutput');
        
        this.initializeEventListeners();
    }

    async fetchTags() {
        const res = await fetch('/api/tags');
        if (!res.ok) return [];
        return await res.json();
    }

    async initialize() {
        this.allTags = await this.fetchTags();
        this.allTags.forEach(tag => {
            this.tags.set(tag, 'neutral');
        });
        this.renderTags();
        this.updateSummary();
    }

    initializeEventListeners() {
        // Search functionality
        this.searchBox.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.renderTags();
        });

        // Prevent context menu on container
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    renderTags() {
        this.container.innerHTML = '';
        
        const filteredTags = this.allTags.filter(tag => 
            tag.toLowerCase().includes(this.searchTerm)
        );

        filteredTags.forEach(tag => {
            const tagElement = this.createTagElement(tag);
            this.container.appendChild(tagElement);
        });
    }

    createTagElement(tag) {
        const div = document.createElement('div');
        div.className = `tag-item ${this.tags.get(tag)}`;
        div.textContent = tag;
        div.dataset.tag = tag;

        // Left click - include
        div.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.setTagState(tag, 'neutral');
            } else {
                this.toggleInclude(tag);
            }
        });

        // Right click - exclude
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.toggleExclude(tag);
        });

        // Middle click - reset to neutral
        div.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                this.setTagState(tag, 'neutral');
            }
        });

        return div;
    }

    toggleInclude(tag) {
        const currentState = this.tags.get(tag);
        this.setTagState(tag, currentState === 'included' ? 'neutral' : 'included');
    }

    toggleExclude(tag) {
        const currentState = this.tags.get(tag);
        this.setTagState(tag, currentState === 'excluded' ? 'neutral' : 'excluded');
    }

    setTagState(tag, state, skipUpdate = false) {
        this.tags.set(tag, state);
        const tagElement = this.container.querySelector(`[data-tag="${tag}"]`);
        if (tagElement) {
            tagElement.className = `tag-item ${state}`;
        }
        if (!skipUpdate) {
            this.updateSummary();
            this.updateFilterOutput();
        }
    }

    getSelectedTags() {
        const included = [];
        const excluded = [];
        
        this.tags.forEach((state, tag) => {
            if (state === 'included') included.push(tag);
            if (state === 'excluded') excluded.push(tag);
        });

        return { included, excluded };
    }

    updateSummary() {
        const { included, excluded } = this.getSelectedTags();
        let summary = '';
        
        if (included.length > 0) {
            summary += `Must include: ${included.join(', ')}`;
        }
        
        if (excluded.length > 0) {
            if (summary) summary += ' | ';
            summary += `Must exclude: ${excluded.join(', ')}`;
        }
        
        if (!summary) {
            summary = 'No filters applied (showing all results)';
        }
        
        this.filterSummary.textContent = summary;
    }

    updateFilterOutput() {
        const filters = this.getSelectedTags();
        this.filterOutput.textContent = JSON.stringify(filters, null, 2);
    }

    clearAll() {
        this.tags.forEach((state, tag) => {
            this.tags.set(tag, 'neutral');
        });
        this.renderTags();
        this.updateSummary();
        this.updateFilterOutput();
    }

    setVisibleTagsState(state) {
        const visibleTags = this.container.querySelectorAll('.tag-item:not(.hidden)');
        visibleTags.forEach(tagElement => {
            const tag = tagElement.dataset.tag;
            this.setTagState(tag, state, true);
        });
        this.updateSummary();
        this.updateFilterOutput();
    }
}

// Global functions for buttons
let tagManager;

function clearAllFilters() {
    tagManager.clearAll();
}

function includeVisible() {
    tagManager.setVisibleTagsState('included');
}

function excludeVisible() {
    tagManager.setVisibleTagsState('excluded');
}
  
  const RANDOM_MODE_STORAGE_KEY = 'pokemonSopRandomOrder';

  function isRandomOrderMode() {
    const v = localStorage.getItem(RANDOM_MODE_STORAGE_KEY);
    if (v === null) return true;
    return v === 'true';
  }

  function setRandomOrderMode(enabled) {
    localStorage.setItem(RANDOM_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    updateOrderModeHint();
  }

  function updateOrderModeHint() {
    const el = document.getElementById('orderModeHint');
    if (!el) return;
    el.textContent = isRandomOrderMode()
      ? 'Next Pokémon is picked at random from filtered list.'
      : 'Next Pokémon follows Dex order among filtered list';
  }

  // --- Character Fetching ---
  async function getAvailableCharacter(selectedTags = [], excludedTags = [], interactedIds = [], options = {}) {
    const { random = true, afterId } = options;
    const params = new URLSearchParams();
    if (selectedTags.length) params.append('tags', selectedTags.join(','));
    if (excludedTags.length) params.append('exclude', excludedTags.join(','));
    if (interactedIds.length) params.append('excludeIds', interactedIds.join(','));
    if (!random && afterId != null && !Number.isNaN(Number(afterId))) {
      params.append('afterId', String(afterId));
    }
    const endpoint = random ? '/api/character/random' : '/api/character/next';
    const res = await fetch(endpoint + '?' + params.toString());
    if (!res.ok) return null;
    return await res.json();
  }
  
  // --- Display Functions ---
  function displayCharacter(character) {
    document.getElementById('character-image').src = character.image_url;
    document.getElementById('character-name').textContent = character.name;
    document.getElementById('character-franchise').textContent = character.franchise;
    const tagsDiv = document.getElementById('character-tags');
    tagsDiv.innerHTML = '';
    if (Array.isArray(character.tags) && character.tags.length > 0) {
        character.tags.forEach(tag => {
            const span = document.createElement('span');
            span.textContent = tag;
            tagsDiv.appendChild(span);
        });
    } else {
        tagsDiv.textContent = 'No tags';
    }
}
  function displayResults(voteType, voteStats, userStats) {
    const resultsDiv = document.getElementById('vote-results');
    const yesCount = voteStats.yesVotes;
    const yesPercentage = Math.round(yesCount / voteStats.totalVotes * 100);
    const noCount = voteStats.noVotes;
    if (userStats.lastEarnedPoints > 0) {
        const isMajority = (voteType && yesPercentage >= 50) || (!voteType && yesPercentage <= 50);
        const pointsAlignment = isMajority ? 'towards Conventional' : 'towards Unconventional';
        document.getElementById('pointsEarned').textContent = userStats.lastEarnedPoints;
        document.getElementById('pointsAlignment').textContent = pointsAlignment;
        document.getElementById('majorityStreak').textContent = userStats.majorityStreak;
        document.getElementById('minorityStreak').textContent = userStats.minorityStreak;
    } else {
        document.getElementById('pointsEarned').textContent = 0;
        document.getElementById('pointsAlignment').textContent = '';
        document.getElementById('majorityStreak').textContent = 0;
        document.getElementById('minorityStreak').textContent = 0;
    }
    updateCharts(yesCount, noCount);
  }
  function displayUserStats(stats) {
    document.getElementById('user-stats').innerHTML = `
      <p>Smashes: ${stats.yesVotesTotal} | Passes: ${stats.noVotesTotal} | Skips: ${stats.skipsTotal}</p>
      <p>Down Bad Rating: ${Math.round(stats.yesVotesTotal / (stats.yesVotesTotal + stats.noVotesTotal) * 100)}%</p>
      <p>Majority Picks: ${stats.majorityTotal} | Minority Picks: ${stats.minorityTotal}</p>
      <p>Conventional Rating: ${stats.majorityPoints} | Unconventional Rating: ${stats.minorityPoints}</p>
      <p>Majority Streak: ${stats.majorityStreak} | Minority Streak: ${stats.minorityStreak}</p>
    `;
  }
  
  // --- Main App Logic ---
  let currentCharacter = null;
  let awaitingNextCharacter = false;
  let stats = getUserStatsFromStorage();
  /** True while results + chart are shown after a vote/skip; same arrow keys advance to next Pokémon. */
  let showingResultsAfterVote = false;
  let loadCharacterBusy = false;

  function isTypingInField() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  }

  /**
   * @param {{ restartSequential?: boolean, keepResultsUntilLoaded?: boolean }} opts
   */
  async function loadCharacter(opts = {}) {
    if (loadCharacterBusy) return;
    loadCharacterBusy = true;
    const keepResults = opts.keepResultsUntilLoaded === true;
    const nextBtn = document.getElementById('next-character');
    let nextBtnPrevHtml = '';
    if (keepResults && nextBtn) {
      nextBtnPrevHtml = nextBtn.innerHTML;
      nextBtn.disabled = true;
      nextBtn.textContent = 'Loading…';
    }

    try {
    if (!keepResults) {
      showingResultsAfterVote = false;
      awaitingNextCharacter = true;
      document.querySelector('.information-section').style.display = 'none';
      document.querySelector('.results-section').style.display = 'none';
      document.querySelector('.chart-section').style.display = 'none';
      document.getElementById('actions').style.display = 'none';
    } else {
      awaitingNextCharacter = true;
      showingResultsAfterVote = false;
    }

    stats = getUserStatsFromStorage();
    const tags = tagManager.getSelectedTags();
    const random = isRandomOrderMode();
    let fetchOpts = { random };
    if (!random) {
      const restart = opts.restartSequential === true;
      if (!restart && currentCharacter && currentCharacter.id != null) {
        fetchOpts.afterId = currentCharacter.id;
      }
    }
    const character = await getAvailableCharacter(
      tags.included,
      tags.excluded,
      stats.interactedCharacters,
      fetchOpts
    );
    if (!character || character.error) {
      awaitingNextCharacter = false;
      document.querySelector('.information-section').style.display = 'none';
      document.querySelector('.results-section').style.display = 'none';
      document.querySelector('.chart-section').style.display = 'none';
      document.querySelector('.error-section').style.display = '';
      document.querySelector('.character-section').style.display = 'none';
      return;
    }

    document.querySelector('.information-section').style.display = 'none';
    document.querySelector('.results-section').style.display = 'none';
    document.querySelector('.chart-section').style.display = 'none';

    currentCharacter = character;
    displayCharacter(character);
    document.querySelector('.error-section').style.display = 'none';
    document.querySelector('.character-section').style.display = '';
    document.getElementById('actions').style.display = '';
    awaitingNextCharacter = false;
    } finally {
      loadCharacterBusy = false;
      if (keepResults && nextBtn) {
        nextBtn.disabled = false;
        if (nextBtnPrevHtml) nextBtn.innerHTML = nextBtnPrevHtml;
      }
    }
  }
  function showResultsSection() {
    document.querySelector('.information-section').style.display = '';
    document.querySelector('.results-section').style.display = '';
    document.querySelector('.chart-section').style.display = '';
    showingResultsAfterVote = true;
  }
  async function handleVote(voteType) {
    if (!currentCharacter) return;
    if (awaitingNextCharacter) return;
    awaitingNextCharacter = true;
    const res = await fetch(`/api/character/${currentCharacter.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: stats.sessionId, voteType })
    });
    const data = await res.json();
    if (!data.success) {
      awaitingNextCharacter = false;
      return;
    }
    // Mark as seen
    stats.interactedCharacters.push(currentCharacter.id);
    // Update stats
    const yesPercentage = (data.newYesVotes / data.totalVotes) * 100.0;
    updateUserStatsAfterVote(voteType, yesPercentage);
    displayUserStats(stats);
    // Show results
    const voteStats = {
      yesVotes: data.newYesVotes,
      noVotes: data.newNoVotes,
      totalVotes: data.totalVotes
    };
    document.getElementById('actions').style.display = 'none';
    displayResults(voteType, voteStats, stats);
    showResultsSection();
  }
  async function handleSkip() {
    if (!currentCharacter) return;
    if (awaitingNextCharacter) return;
    awaitingNextCharacter = true;
    await fetch(`/api/character/${currentCharacter.id}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: stats.sessionId })
    });
    // Mark as seen
    stats.lastEarnedPoints = 0;
    stats.interactedCharacters.push(currentCharacter.id);
    stats.skipsTotal++;
    saveUserStatsToStorage(stats);
    displayUserStats(stats);
    // Show results (fetch stats)
    const res = await fetch(`/api/character/${currentCharacter.id}/results`);
    const data = await res.json();
    document.getElementById('actions').style.display = 'none';
    displayResults(false, data.voteStats, stats);
    showResultsSection();
  }
  function updateUserStatsAfterVote(voteType, yesPercentage) {
    const isMajority = (voteType && yesPercentage >= 50) || (!voteType && yesPercentage <= 50);
    if (voteType) stats.yesVotesTotal++;
    else stats.noVotesTotal++;
    const majorityPercentage = Math.max(yesPercentage, 100 - yesPercentage);
    const minorityPercentage = Math.min(yesPercentage, 100 - yesPercentage);
    if (isMajority) {
      stats.majorityTotal++;
      stats.majorityStreak++;
      stats.minorityStreak = 0;
      stats.lastEarnedPoints = Math.floor((majorityPercentage - 50) * 2);
      stats.majorityPoints += stats.lastEarnedPoints;
    } else {
      stats.minorityTotal++;
      stats.minorityStreak++;
      stats.majorityStreak = 0;
      stats.lastEarnedPoints = Math.floor((50 - minorityPercentage) * 3);
      stats.minorityPoints += stats.lastEarnedPoints;
    }
    saveUserStatsToStorage(stats);
  }
  async function resetStats() {
    stats = {
        majorityStreak: 0,
        minorityStreak: 0,
        majorityTotal: 0,
        minorityTotal: 0,
        yesVotesTotal: 0,
        noVotesTotal: 0,
        skipsTotal: 0,
        majorityPoints: 0,
        minorityPoints: 0,
        lastEarnedPoints: 0,
        interactedCharacters: [],
        sessionId: generateSessionId()
    };
    saveUserStatsToStorage(stats);
    displayUserStats(stats);
    currentCharacter = null;
    showingResultsAfterVote = false;
    loadCharacterBusy = false;
    awaitingNextCharacter = false;
    await loadCharacter({ restartSequential: true });
  }
  
  function updateVoteBar(yesVotes, noVotes) {
    const total = yesVotes + noVotes;
    const yesPercent = total > 0 ? (yesVotes / total) * 100 : 0;
    const noPercent = total > 0 ? (noVotes / total) * 100 : 0;
    document.querySelector('.vote-bar-smash').style.width = yesPercent + '%';
    document.querySelector('.vote-bar-pass').style.width = noPercent + '%';
  }

  // Update charts with new data
  function updateCharts(yesVotes, noVotes) {
    const total = yesVotes + noVotes;
    const yesPercentage = total > 0 ? Math.round((yesVotes / total) * 100) : 0;
    const noPercentage = total > 0 ? Math.round((noVotes / total) * 100) : 0;

    // Update custom vote bar
    updateVoteBar(yesVotes, noVotes);

    // Update stats
    document.getElementById('smashCount').textContent = yesVotes;
    document.getElementById('passCount').textContent = noVotes;
    document.getElementById('totalVotes').textContent = total;
    document.getElementById('smashPercentage').textContent = yesPercentage + '%';
    document.getElementById('passPercentage').textContent = noPercentage + '%';
  }

  // --- Event Listeners ---
  document.addEventListener('keydown', (e) => {
    if (isTypingInField()) return;
    const key = e.key;
    const isArrow = key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowDown';
    if (!isArrow) return;

    if (showingResultsAfterVote) {
      e.preventDefault();
      loadCharacter({ keepResultsUntilLoaded: true });
      return;
    }

    const charSection = document.querySelector('.character-section');
    if (!charSection || charSection.style.display === 'none') return;
    if (!currentCharacter || awaitingNextCharacter || loadCharacterBusy) return;
    if (document.getElementById('actions').style.display === 'none') return;

    e.preventDefault();
    if (key === 'ArrowLeft') handleVote(true);
    else if (key === 'ArrowRight') handleVote(false);
    else if (key === 'ArrowDown') handleSkip();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    tagManager = new TagFilterManager();
    await tagManager.initialize();
    const randomToggle = document.getElementById('randomModeToggle');
    if (randomToggle) {
      randomToggle.checked = isRandomOrderMode();
      randomToggle.addEventListener('change', () => {
        setRandomOrderMode(randomToggle.checked);
      });
    }
    updateOrderModeHint();
    displayUserStats(stats);
    await loadCharacter({ restartSequential: true });
  });