/**
 * System-wide budget for "live" decoded media elements.
 *
 * Chromium keeps decoded bitmaps of images/videos alive as long as a live
 * HTMLImageElement/HTMLVideoElement still references them (memory_cache.cc /
 * image_loader.cc research). The old architecture capped history/per-player
 * independently, so a grid of N ImagePlayers could hold N × (history+ready)
 * decoded images at once — the multi-GB RAM climb.
 *
 * This module tracks every live ImagePlayer instance and caps the TOTAL number
 * of media elements currently held across all of them. Each player's effective
 * history cap is derived from the shared budget so no single player (or the
 * grid as a whole) can exceed it.
 */
export class MediaBudget {
  private static _budget = 48;
  private static _players = new Map<number, any>();

  static setBudget(b: number): void {
    if (b > 0) this._budget = b;
  }

  static getBudget(): number {
    return this._budget;
  }

  static register(player: any): void {
    this._players.set(player._ffPlayerId, player);
  }

  static unregister(playerId: number): void {
    this._players.delete(playerId);
  }

  static playerCount(): number {
    return this._players.size;
  }

  /** Total media elements held across all players (history + ready queues). */
  static totalLive(): number {
    let n = 0;
    for (const p of this._players.values()) {
      n += (p?.state?.historyPaths?.length || 0);
      n += (p?.state?.readyToDisplay?.length || 0);
    }
    return n;
  }

  /** Fair share of the budget for a single player (with a sane floor). */
  static perPlayerCap(): number {
    const n = Math.max(1, this._players.size);
    return Math.max(4, Math.floor(this._budget / n));
  }

  /**
   * True when the whole app has reached its decoded-media budget and should
   * stop preloading more until evictions happen.
   */
  static isExhausted(extra = 0): boolean {
    return this.totalLive() + extra >= this._budget;
  }

  /**
   * Sum of ready-to-display queue lengths (pre-decoded buffer). Used to stop
   * preloading ahead of display before it consumes the budget.
   */
  static totalReady(): number {
    let n = 0;
    for (const p of this._players.values()) {
      n += (p?.state?.readyToDisplay?.length || 0);
    }
    return n;
  }

  /**
   * Evict cold items across all players until the shared budget is satisfied
   * (or nothing more is evictable). Returns number of items evicted.
   */
  static evictColdest(maxIterations = 6): number {
    let evicted = 0;
    let guards = 0;
    while (this.isExhausted() && guards < maxIterations * Math.max(1, this._players.size)) {
      let madeProgress = false;
      for (const p of this._players.values()) {
        if (typeof p._evictVisibleProtected === 'function') {
          const n = p._evictVisibleProtected();
          if (n > 0) {
            madeProgress = true;
            evicted += n;
          }
        }
        if (!this.isExhausted()) break;
      }
      guards++;
      if (!madeProgress) break;
    }
    return evicted;
  }

  static dump(): string {
    const parts: string[] = [];
    for (const p of this._players.values()) {
      parts.push(`p${p._ffPlayerId}:h${p?.state?.historyPaths?.length||0}/r${p?.state?.readyToDisplay?.length||0}`);
    }
    return parts.join(' ');
  }
}
