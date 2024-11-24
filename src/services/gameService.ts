import axios from 'axios';

const RAWG_API_KEY = import.meta.env.VITE_RAWG_API_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';

interface GameSearchResult {
    count: number;
    results: Array<{
        name: string;
        slug: string;
        released: string;
        metacritic: number;
        rating: number;
        ratings_count: number;
        added: number;
        playtime: number;
    }>;
}

interface CacheEntry {
    value: boolean;
    timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000;

function getFromCache(key: string): boolean | null {
    const item = localStorage.getItem(`game_cache_${key}`);
    if (!item) return null;

    const entry: CacheEntry = JSON.parse(item);
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`game_cache_${key}`);
        return null;
    }

    return entry.value;
}

function setToCache(key: string, value: boolean): void {
    const entry: CacheEntry = {
        value,
        timestamp: Date.now()
    };
    localStorage.setItem(`game_cache_${key}`, JSON.stringify(entry));
}

function cleanProcessName(processName: string): string {
    return processName
        .replace(/\.(exe|app)$/, '')
        .replace(/[-_.]/, ' ')
        .toLowerCase()
        .trim();
}

export async function isGameByName(processName: string): Promise<boolean> {
    const cleanName = cleanProcessName(processName);

    const cachedResult = getFromCache(cleanName);
    if (cachedResult !== null) {
        return cachedResult;
    }

    try {
        const response = await axios.get<GameSearchResult>(`${RAWG_BASE_URL}/games`, {
            params: {
                key: RAWG_API_KEY,
                search: cleanName,
                page_size: 10,
                ordering: '-metacritic,-rating,-added',
                exclude_additions: true,
                search_precise: true
            }
        });

        const isGame = response.data.results.some(game => {
            const gameName = game.name.toLowerCase();
            
            const nameMatchScore = calculateNameMatchScore(cleanName, gameName);
            
            if (nameMatchScore > 0.9) {
                return true;
            }

            if (nameMatchScore > 0.6) {
                const popularityScore = calculatePopularityScore(game);
                return (nameMatchScore * 0.6 + popularityScore * 0.4) > 0.7;
            }

            return false;
        });

        setToCache(cleanName, isGame);
        return isGame;
    } catch (error) {
        console.error('Fehler bei der RAWG API Abfrage:', error);
        return false;
    }
}

function calculateNameMatchScore(name1: string, name2: string): number {
    if (name1 === name2) return 1;
    
    if (name1.includes(name2) || name2.includes(name1)) {
        const lengthDiff = Math.abs(name1.length - name2.length);
        return Math.max(0.7, 1 - (lengthDiff / Math.max(name1.length, name2.length)));
    }
    
    const distance = levenshteinDistance(name1, name2);
    const maxLength = Math.max(name1.length, name2.length);
    return Math.max(0, 1 - (distance / maxLength));
}

function calculatePopularityScore(game: GameSearchResult['results'][0]): number {
    let score = 0;
    
    if (game.metacritic) {
        score += (game.metacritic / 100) * 0.4;
    }
    
    if (game.rating && game.ratings_count > 0) {
        score += (game.rating / 5) * 0.3;
    }
    
    if (game.added > 0) {
        const addedScore = Math.min(Math.log10(game.added) / 5, 1);
        score += addedScore * 0.3;
    }
    
    return score;
}

function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j - 1] + 1,
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1
                );
            }
        }
    }

    return dp[m][n];
}

export async function preloadCommonGames(gameNames: string[]): Promise<void> {
    for (const name of gameNames) {
        if (!getFromCache(name)) {
            await isGameByName(name);
        }
    }
}