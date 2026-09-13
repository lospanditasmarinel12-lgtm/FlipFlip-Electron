import * as React from 'react';
import wretch from 'wretch';
import gifInfo from 'gif-info';

import {CircularProgress, Container, Typography} from "@mui/material";
import {webFrame} from "electron";

import {toArrayBuffer, urlToPath} from '../../data/utils';
import {getSourceType, isImageOrVideo, isVideo} from "./Scrapers";
import {GO, OF, ST, TF, VO} from '../../data/const';
import Config from "../../data/Config";
import Scene from "../../data/Scene";
import ImageView from './ImageView';
import {buildLiveShowList, LiveShowItem} from '../../data/getLiveShowList';
import {isLogEnabled} from '../../data/logging';
import fs from "fs";
import ChildCallbackHack from './ChildCallbackHack';
import Audio from "../../data/Audio";

const PURGE_COOLDOWN_MS = 2000;
const MAX_MIRROR = 50;

/**
 * Synchronously read a GIF's total duration (ms) from a file:// URL. Returns
 * null when the source is not a readable local file.
 */
function readGifDurationSync(src: string): number | null {
  try {
    if (!src.startsWith("file://")) return null;
    const info: any = gifInfo(toArrayBuffer(fs.readFileSync(urlToPath(src))));
    return (info?.durationChrome || info?.duration || 0) * 1000;
  } catch (e) {
    return null;
  }
}

/**
 * Live Show player.
 *
 * Difference from the classic preload pipeline:
 *  - Builds a plain ordered URL list ONCE (`getLiveShowList`) and walks it by
 *    index — items are never popped or destroyed from the queue.
 *  - Only ONE media element is alive at a time (current). When `backForth` is
 *    enabled the immediately-previous element is kept alive so stepping back is
 *    instant; anything older is reconstructed on demand from the URL queue.
 *  - One image ahead is preloaded (images only) so advances swap instantly;
 *    videos and nimja pages are never preloaded.
 *  - Back/forward re-render from the queue by moving a cursor; auto-advance is
 *    paused while historyOffset < 0 and the forward button acts as a manual
 *    advance. A small record mirror (URLs only, capped) feeds PlayerBars /
 *    context menu / watermark metadata — no placeholders, no decoded media.
 */
export default class LiveShowPlayer extends React.Component {
  readonly props: {
    config: Config,
    scene: Scene,
    currentAudio?: Audio,
    gridView: boolean,
    isPlaying: boolean,
    hasStarted: boolean,
    isOverlay?: boolean,
    allURLs: Map<string, Array<string>>,
    allPosts: Map<string, string>,
    advanceHack?: ChildCallbackHack,
    historyOffset?: number,
    setHistoryOffset?(offset: number): void,
    setHistoryPaths?(paths: Array<any>): void,
    setVideo?(video: HTMLVideoElement): void,
    onLoaded?(): void,
    onEndScene?(): void,
    setTimeToNextFrame?(t: number): void,
  };

  readonly state = {
    current: null as HTMLImageElement | HTMLVideoElement | HTMLIFrameElement | null,
    slot: null as HTMLImageElement | HTMLVideoElement | null,
    list: Array<LiveShowItem>(),
    index: 0,
    exhausted: false,
    started: false,
  };

  _isMounted = false;
  _listReady = false;
  _lastIndex = -1;
  _cursor = 0;
  // Real walk sequence (indices actually shown). Going "back" in a random-ordered
  // scene must show what was previously displayed — `cursor - 1` arithmetic
  // cannot (the previous random index is arbitrary), which is why Back used to
  // appear to "load more new images".
  _history: Array<number> = [];
  _lastPurgedUrl: string | null = null;
  _purgeScheduled = false;
  _loading = false;
  _loadToken = 0;
  _shownUrl: string | null = null;
  _prevUrl: string | null = null;
  _lastPurgeAt = 0;
  _timeout: ReturnType<typeof setTimeout> | null = null;
  _loadTimeout: ReturnType<typeof setTimeout> | null = null;

  _mirror: Array<{url: string, source: string, post: string | null}> = [];
  _keptPrev: HTMLImageElement | HTMLVideoElement | null = null;
  _keptUrl: string | null = null;
  _preloaded: HTMLImageElement | null = null;
  _preloadUrl: string | null = null;
  _preloadToken = 0;
  _slotToken = 0;
  _slotRec: {url: string, source: string, post: string | null} | null = null;

  /**
   * Deferred decoded-cache purge, run once per displayed item (idle-preferred).
   */
  _purgeCache(url: string | null) {
    if (!this._isMounted) return;
    if (!url) return;
    if (Date.now() - this._lastPurgeAt < PURGE_COOLDOWN_MS) return;
    this._lastPurgeAt = Date.now();
    if (this._lastPurgedUrl === url) return;
    this._lastPurgedUrl = url;
    if (this._purgeScheduled) return;
    this._purgeScheduled = true;
    const run = () => {
      this._purgeScheduled = false;
      if (!this._isMounted) return;
      try { webFrame.clearCache(); } catch (e) {}
      try { (global as any).gc?.(); } catch (e) {}
    };
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(run, {timeout: 1000});
    } else {
      setTimeout(run, 0);
    }
  }

  componentDidMount() {
    this._isMounted = true;
    this._buildList();
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = () => this.advance(true, 'hack');
    }
  }

  componentDidUpdate(prevProps: any) {
    if (prevProps.allURLs !== this.props.allURLs) {
      this._buildList();
    }
    const offset = this.props.historyOffset != null ? this.props.historyOffset : 0;
    if (offset < 0) {
      const len = this.state.list.length;
      let rec: LiveShowItem | null = null;
      if (len > 0) {
        const idx = this._historyIndex(offset);
        rec = this.state.list[idx];
      }
      const keptCovers = offset === -1 && !!this._keptPrev && rec != null && this._keptUrl === rec.url;
      if (keptCovers) {
        if (this.state.slot != null || this._slotRec != null) {
          this._slotToken++;
          this._slotRec = null;
          this.setState({slot: null});
        }
      } else if (rec != null && (!this.state.slot || this._slotRec == null || this._slotRec.url !== rec.url)) {
        this._loadSlot(rec);
      } else if (rec == null && (this.state.slot != null || this._slotRec != null)) {
        this._slotToken++;
        this._slotRec = null;
        this.setState({slot: null});
      }
    } else if (this.state.slot != null || this._slotRec != null) {
      this._slotToken++;
      this._slotRec = null;
      this.setState({slot: null});
    }
    if ((!prevProps.hasStarted && this.props.hasStarted) ||
        (!prevProps.isPlaying && this.props.isPlaying)) {
      this._start();
    }
    if (prevProps.isPlaying && !this.props.isPlaying) {
      this._stop();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = null;
    }
    this._purgeScheduled = false;
    this._clearTimers();
    this._destroyElement(this.state.current);
    this._destroyElement(this.state.slot);
    this._destroyElement(this._keptPrev);
    this._discardPreload();
    this.state.list = [];
    this.props.setTimeToNextFrame?.(-1);
  }

  _clearTimers() {
    if (this._timeout != null) { clearTimeout(this._timeout); this._timeout = null; }
    if (this._loadTimeout != null) { clearTimeout(this._loadTimeout); this._loadTimeout = null; }
  }

  _destroyElement(el: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement | null | undefined) {
    if (!el) return;
    if (el instanceof HTMLVideoElement) {
      try { el.pause(); } catch (e) {}
      try { el.removeAttribute('src'); el.load(); } catch (e) {}
    }
    try { el.onerror = null; el.onabort = null; } catch (e) {}
    if (el instanceof HTMLImageElement) {
      try { el.src = ''; } catch (e) {}
    }
    try { el.remove(); } catch (e) {}
  }

  _pushMirror(item: LiveShowItem) {
    this._mirror.push({url: item.url, source: item.source, post: item.post});
    if (this._mirror.length > MAX_MIRROR) {
      this._mirror.splice(0, this._mirror.length - MAX_MIRROR);
    }
    if (this.props.setHistoryPaths) {
      this.props.setHistoryPaths(this._mirror.slice());
    }
  }

  _discardPreload() {
    if (this._preloaded) {
      this._destroyElement(this._preloaded);
      this._preloaded = null;
    }
    this._preloadUrl = null;
    this._preloadToken++;
  }

  _preloadReady(el: HTMLImageElement | null): boolean {
    if (!el || !el.complete) return false;
    const num = (el as any)._decoded === true;
    if (!num) return false;
    const min = this.props.config.displaySettings.minImageSize;
    return el.naturalWidth >= min && el.naturalHeight >= min;
  }

  _buildList() {
    if (!this._isMounted) return;
    this._listReady = false;
    this._lastIndex = -1;
    this._history = [];
    this._discardPreload();
    const prevList = this.state.list;
    const prevShownUrl = this._shownUrl;
    const list = buildLiveShowList(this.props.scene, this.props.allURLs, this.props.allPosts);
    this.setState(
      {
        list,
        index: 0,
        exhausted: list.length === 0,
        current: this.state.current,
        slot: null,
      },
      () => {
        if (!this._isMounted) return;
        this._listReady = true;
        this._cursor = Math.min(this._cursor, Math.max(list.length - 1, 0));
        if (!this.state.started) {
          this.setState({started: true});
          this.advance(true, 'build');
          return;
        }
        if (this.props.isPlaying && !this._loading) {
          if (prevList.length === 0 || (prevShownUrl != null && !list.some((it) => it.url === prevShownUrl))) {
            this.advance(true, 'build');
            return;
          }
        }
        if (isLogEnabled('liveshow')) {
          console.log('[LiveShow] build (no advance)', {prevLen: prevList.length, newLen: list.length, shownUrl: prevShownUrl, loading: this._loading});
        }
      },
    );
  }

  _start() {
    if (!this._isMounted) return;
    if (!this.state.started) {
      if (!this._listReady) {
        this.setState({started: true});
        return;
      }
      this.setState({started: true});
      this.advance(true, 'start');
      return;
    }
    // Already started (e.g. Play pressed after Back paused playback): the dwell
    // timer was consumed by the pause, so re-arm it for the current element to
    // resume auto-advance. Guard on historyOffset so we never schedule forward
    // motion while still stepping back through the queue.
    const offset = this.props.historyOffset != null ? this.props.historyOffset : 0;
    if (offset >= 0 && this._listReady) {
      const el = this.state.current;
      const len = this.state.list.length;
      if (el != null && len > 0 && !(el instanceof HTMLIFrameElement)) {
        const item = this.state.list[this._historyIndex(offset)];
        if (item) {
          if (this._timeout) clearTimeout(this._timeout);
          this._scheduleAdvance(item, el);
        }
      }
    }
  }

  _stop() {
    this._clearTimers();
    if (this._isMounted) {
      this.setState({started: false});
    }
  }

  /* ==== The core: one element at a time, destroy-on-advance ==== */

  advance(force = false, reason = '?') {
    if (!this._isMounted) return;
    // Paused while stepping back through the queue; resume happens via the
    // forward control once historyOffset returns to 0.
    if (this.props.historyOffset != null && this.props.historyOffset < 0) return;
    if (isLogEnabled('liveshow')) {
      console.log('[LiveShow] advance', {reason, force, isPlaying: this.props.isPlaying, started: this.state.started, loading: this._loading, listLen: this.state.list.length, shownUrl: this._shownUrl});
    }
    if (!(force || (this.props.isPlaying && this.state.started))) {
      return;
    }
    if (!this._listReady) return;
    if (this.state.exhausted || this.state.list.length === 0) {
      if (this.props.onEndScene) this.props.onEndScene();
      return;
    }
    this._clearTimers();
    this._loading = true;
    this._loadToken++;
    const len = this.state.list.length;

    // backForth retention: the previously-kept element is now the "second
    // previous" — destroy it. Otherwise the current element is either kept
    // alive as the single previous (backForth) or destroyed immediately.
    if (this._keptPrev) {
      this._purgeCache(this._keptUrl);
      this._destroyElement(this._keptPrev);
      this._keptPrev = null;
      this._keptUrl = null;
    }
    const cur = this.state.current;
    this._prevUrl = this._shownUrl;
    if (cur) {
      if (this.props.scene.backForth) {
        this._keptPrev = cur as HTMLImageElement | HTMLVideoElement;
        this._keptUrl = this._shownUrl;
      } else {
        this._purgeCache(this._prevUrl);
        this._destroyElement(cur);
      }
    }

    let nextIndex: number;
    if (this.props.scene.orderFunction == OF.random) {
      if (len <= 1) {
        nextIndex = 0;
      } else {
        let candidate = Math.floor(Math.random() * len);
        if (candidate === this._lastIndex) {
          candidate = (candidate + 1) % len;
        }
        nextIndex = candidate;
      }
    } else {
      nextIndex = this.state.index % len;
    }
    this._lastIndex = nextIndex;
    this._cursor = nextIndex;
    this._history.push(nextIndex);
    if (this._history.length > 500) {
      this._history.splice(0, this._history.length - 500);
    }
    const item = this.state.list[nextIndex];

    this.setState(
      {index: nextIndex + 1, current: null, slot: null},
      () => this._loadOrCommit(item),
    );
  }

  _historyIndex(offset: number): number {
    const len = this.state.list.length;
    if (len <= 0) return 0;
    if (this._history.length > 0) {
      const idx = this._history.length - 1 + offset;
      if (idx >= 0 && idx < this._history.length) {
        const h = this._history[idx];
        if (h >= 0 && h < len) return h;
      }
    }
    return (((this._cursor + offset) % len) + len) % len;
  }

  _commitElement(el: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement, item: LiveShowItem) {
    if (!this._isMounted) return;
    this._loading = false;
    this._shownUrl = item.url;
    this._onLoaded(el);
    this._pushMirror(item);
    if (el instanceof HTMLVideoElement) {
      this._scheduleAdvance(item, el);
    } else if (el instanceof HTMLImageElement) {
      this._scheduleAdvance(item, el);
    } else {
      this._scheduleAdvance(item);
    }
  }

  _loadOrCommit(item: LiveShowItem) {
    if (!this._isMounted) return;
    if (this._preloadUrl != null && this._preloadUrl === item.url && this._preloadReady(this._preloaded)) {
      const el = this._preloaded;
      this._preloaded = null;
      this._preloadUrl = null;
      this._commitElement(el, item);
    } else {
      this._discardPreload();
      this._loadItem(item);
    }
  }

  _schedulePreload(currentItem: LiveShowItem) {
    if (!this._isMounted) return;
    this._discardPreload();
    if (this.props.historyOffset != null && this.props.historyOffset < 0) return;
    // Images only: videos and nimja pages are never preloaded.
    if (getSourceType(currentItem.url) == ST.nimja || isVideo(currentItem.url, false)) return;
    const len = this.state.list.length;
    if (len < 2) return;
    let nextIndex: number;
    if (this.props.scene.orderFunction == OF.random) {
      let candidate = Math.floor(Math.random() * len);
      if (candidate === this._lastIndex) {
        candidate = (candidate + 1) % len;
      }
      nextIndex = candidate;
    } else {
      nextIndex = this.state.index % len;
    }
    const next = this.state.list[nextIndex];
    if (!next) return;
    if (getSourceType(next.url) == ST.nimja || isVideo(next.url, false)) return;

    const p = new Image();
    p.setAttribute("source", next.source);
    if (next.post) p.setAttribute("post", next.post);
    this._preloadToken++;
    const tok = this._preloadToken;
    p.onload = () => {
      if (tok !== this._preloadToken) {
        this._destroyElement(p);
        return;
      }
      if (p.decode) {
        p.decode().then(() => {
          if (tok === this._preloadToken) (p as any)._decoded = true;
        }).catch(() => {});
      } else {
        (p as any)._decoded = true;
      }
    };
    p.onerror = p.onabort = () => {
      if (tok === this._preloadToken) {
        this._preloaded = null;
        this._preloadUrl = null;
      }
    };
    p.src = next.url;
    this._preloaded = p;
    this._preloadUrl = next.url;
  }

  _loadSlot(rec: LiveShowItem) {
    if (!rec || !this._isMounted) return;
    this._slotToken++;
    const tok = this._slotToken;
    this._slotRec = rec;
    const isVid = isVideo(rec.url, false);
    const el = isVid ? document.createElement('video') : document.createElement('img');
    el.setAttribute("source", rec.source);
    if (rec.post) el.setAttribute("post", rec.post);
    if (isVid) {
      const video = el as HTMLVideoElement;
      video.volume = 0;
      video.onloadeddata = () => {
        if (tok === this._slotToken) this.setState({slot: video});
      };
      video.onerror = () => {};
      video.onabort = () => {};
      video.src = rec.url;
      video.load();
    } else {
      const img = el as HTMLImageElement;
      img.onload = () => {
        if (tok === this._slotToken) this.setState({slot: img});
      };
      img.onerror = () => {};
      img.onabort = () => {};
      img.src = rec.url;
    }
  }

  _loadItem(item: LiveShowItem) {
    if (!this._isMounted) return;
    const token = this._loadToken;

    const fileType = getSourceType(item.url);
    if (fileType != ST.nimja && !isImageOrVideo(item.url, true)) {
      this.advance(true, 'skip-nonmedia');
      return;
    }

    if (fileType == ST.nimja) {
      if (token !== this._loadToken) return;
      const iframe = document.createElement('iframe');
      iframe.setAttribute("source", item.source);
      if (item.post) iframe.setAttribute("post", item.post);
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
      iframe.oncontextmenu = () => { return false; };
      iframe.src = item.url;
      this._commitElement(iframe, item);
      return;
    }

    if (isVideo(item.url, false)) {
      const video = document.createElement('video');
      video.setAttribute("source", item.source);
      if (item.post) video.setAttribute("post", item.post);
      video.volume = 0;
      video.preload = "auto";
      video.src = item.url;

      video.onloadedmetadata = () => {
        if (token !== this._loadToken) return;
        const skipStart = this.props.scene.skipVideoStart / 1000;
        const skipEnd = this.props.scene.skipVideoEnd / 1000;
        if ((skipStart > 0 || skipEnd > 0) && (video.duration - skipStart - skipEnd) > 0) {
          video.setAttribute("start", skipStart.toString());
          video.setAttribute("end", (video.duration - skipEnd).toString());
        }
        let speed = this.props.scene.videoSpeed;
        if (this.props.scene.videoRandomSpeed) {
          speed = Math.floor(Math.random() * (this.props.scene.videoSpeedMax - this.props.scene.videoSpeedMin + 1)) + this.props.scene.videoSpeedMin;
        }
        video.setAttribute("speed", speed.toString());
        if (video.hasAttribute("start") && video.hasAttribute("end")) {
          const start = parseFloat(video.getAttribute("start"));
          const end = parseFloat(video.getAttribute("end"));
          if (this.props.scene.randomVideoStart && (!this.props.scene.continueVideo || !video.currentTime)) {
            video.currentTime = start + (Math.random() * (end - start));
          } else if (video.currentTime < start || video.currentTime > end) {
            video.currentTime = start;
          }
        } else if (this.props.scene.randomVideoStart && (!this.props.scene.continueVideo || !video.currentTime)) {
          video.currentTime = Math.random() * video.duration;
        }
      };

      let ready = false;
      const finish = () => {
        if (!this._isMounted || ready) return;
        if (token !== this._loadToken) return;
        ready = true;
        this._commitElement(video, item);
      };

      const onError = () => {
        if (this._isMounted && token === this._loadToken) this.advance(true, 'video-error');
      };

      video.onloadeddata = () => {
        if (token !== this._loadToken) return;
        if (video.videoWidth < this.props.config.displaySettings.minVideoSize
          || video.videoHeight < this.props.config.displaySettings.minVideoSize) {
          onError();
        } else {
          finish();
        }
      };
      video.onerror = () => onError();
      video.onabort = () => {};
      video.onended = () => {
        if (token !== this._loadToken) return;
        if (this.props.scene.videoOption == VO.full) {
          this.advance(true, 'video-ended');
        } else {
          video.play();
        }
      };
      this._loadTimeout = setTimeout(onError, 20000);
      video.load();
      return;
    }

    // image / gif
    const img = new Image();
    img.setAttribute("source", item.source);
    if (item.post) img.setAttribute("post", item.post);

    const finish = () => {
      if (!this._isMounted) return;
      if (token !== this._loadToken) return;
      this._commitElement(img, item);
    };

    img.onload = () => {
      if (token !== this._loadToken) return;
      if (img.width < this.props.config.displaySettings.minImageSize
        || img.height < this.props.config.displaySettings.minImageSize) {
        this.advance(true, 'img-toosmall');
        return;
      }
      if (img.decode) {
        img.decode().then(() => finish()).catch(() => finish());
      } else {
        finish();
      }
    };
    img.onerror = () => {
      if (token === this._loadToken) this.advance(true, 'img-error');
    };
    img.onabort = () => {};
    img.src = item.url;
  }

  _onLoaded(el: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement) {
    if (!this._isMounted) return;
    (el as any).key = this.state.index;
    this.setState({current: el});
    if (this.props.setVideo && el instanceof HTMLVideoElement) {
      this.props.setVideo(el);
    }
    if (this.props.onLoaded) this.props.onLoaded();
  }

  _scheduleAdvance(item: LiveShowItem, el?: HTMLVideoElement | HTMLImageElement) {
    if (!this._isMounted) return;
    let timeToNextFrame = 0;
    switch (this.props.scene.timingFunction) {
      case TF.random:
        timeToNextFrame = Math.floor(Math.random() * (this.props.scene.timingMax - this.props.scene.timingMin + 1)) + this.props.scene.timingMin;
        break;
      case TF.sin:
        const sinRate = (Math.abs(this.props.scene.timingSinRate - 100) + 2) * 1000;
        timeToNextFrame = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (this.props.scene.timingMax - this.props.scene.timingMin + 1)) + this.props.scene.timingMin;
        break;
      case TF.bpm:
        const bpm = this.props.currentAudio ? this.props.currentAudio.bpm : 60;
        const bpmMulti = this.props.scene.timingBPMMulti / 10;
        timeToNextFrame = 60000 / (bpm * bpmMulti);
        if (!timeToNextFrame) timeToNextFrame = 1000;
        break;
      case TF.constant:
        timeToNextFrame = this.props.scene.timingConstant;
        if (!timeToNextFrame && timeToNextFrame != 0) timeToNextFrame = 1000;
        break;
      default:
        timeToNextFrame = this.props.scene.timingConstant;
        if (!timeToNextFrame) timeToNextFrame = 1000;
        break;
    }

    if (el instanceof HTMLImageElement && /\.gif($|\?)/i.test(el.src)) {
      if (this.props.scene.gifOption == GO.full || this.props.scene.gifOption == GO.atLeast) {
        let gifDurMs = (el as any).__ff_gifDurMs as number | undefined;
        if (gifDurMs == null) {
          try {
            if (el.src.startsWith("file://")) {
              gifDurMs = readGifDurationSync(el.src);
            }
          } catch (e) {}
          if (gifDurMs == null) {
            // Non-file scheme (scraped http GIF, custom protocol): read the
            // duration asynchronously and re-arm the dwell timer once known,
            // otherwise GO.full GIFs would just loop forever on the generic
            // timing instead of progressing.
            if (!(el as any).__ff_durPending) {
              (el as any).__ff_durPending = true;
              const src = el.src;
              this.readGifDurationAsync(el).then((dur: number | null) => {
                if (this._isMounted && this.state.current === el && this.props.isPlaying && this.state.started &&
                  (this.props.historyOffset == null || this.props.historyOffset >= 0)) {
                  if (dur != null && dur > 0) {
                    if (this._timeout) clearTimeout(this._timeout);
                    this._scheduleAdvance(item, el);
                  }
                }
              });
            }
          } else {
            (el as any).__ff_gifDurMs = gifDurMs;
          }
        }
        if (gifDurMs != null && gifDurMs > 0) {
          if (this.props.scene.gifOption == GO.full) {
            timeToNextFrame = gifDurMs;
          } else {
            let dur = 0;
            do { dur += gifDurMs; } while (dur < this.props.scene.gifTimingConstant);
            timeToNextFrame = dur;
          }
        }
      } else if (this.props.scene.gifOption == GO.part) {
        timeToNextFrame = this.props.scene.gifTimingConstant;
      } else if (this.props.scene.gifOption == GO.partr) {
        timeToNextFrame = Math.floor(Math.random() * (this.props.scene.gifTimingMax - this.props.scene.gifTimingMin + 1)) + this.props.scene.gifTimingMin;
      }
    } else if (el instanceof HTMLVideoElement) {
      switch (this.props.scene.videoOption) {
        case VO.full:
          return;
        case VO.part:
          timeToNextFrame = this.props.scene.videoTimingConstant;
          break;
        case VO.partr:
          timeToNextFrame = Math.floor(Math.random() * (this.props.scene.videoTimingMax - this.props.scene.videoTimingMin + 1)) + this.props.scene.videoTimingMin;
          break;
        case VO.atLeast:
          timeToNextFrame = this.props.scene.videoTimingConstant;
          break;
      }
    }

    timeToNextFrame = Math.max(timeToNextFrame, 250);

    if (isLogEnabled('liveshow')) {
      console.log('[LiveShow] schedule', {tf: this.props.scene.timingFunction, url: item.url, timeToNextFrame});
    }

    if (this.props.setTimeToNextFrame) this.props.setTimeToNextFrame(timeToNextFrame);

    // Preload one image ahead (images only), then arm the dwell timer.
    this._schedulePreload(item);

    this._timeout = setTimeout(() => {
      if (this._isMounted && this.props.isPlaying && this.state.started &&
        (this.props.historyOffset == null || this.props.historyOffset >= 0)) {
        this.advance(true, 'timer');
      }
    }, timeToNextFrame);
  }

  /**
   * Asynchronously read a GIF's total duration (ms) for non-file:// srcs
   * (scraped http(s) URLs, custom protocols). Caches the result on the element
   * so _scheduleAdvance can reuse it without re-fetching. Resolves null when
   * the src isn't a readable GIF.
   */
  async readGifDurationAsync(el: HTMLImageElement): Promise<number | null> {
    const src = el.src;
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      const ct = resp.headers.get('content-type') || '';
      if (!(ct.includes('image/gif') || /\.gif($|\?)/i.test(src))) return null;
      const buf = await resp.arrayBuffer();
      const info: any = gifInfo(new Uint8Array(buf));
      const dur = (info?.durationChrome || info?.duration || 0) * 1000;
      (el as any).__ff_gifDurMs = dur;
      return dur;
    } catch (e) {
      return null;
    }
  }

  /* ==== Render: reuse ImageView ==== */

  render() {
    const style: any = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      position: this.props.gridView ? 'static' : 'fixed',
      zIndex: this.props.isOverlay ? 4 : 'auto',
    };
    const offset = this.props.historyOffset != null ? this.props.historyOffset : 0;
    let shown = this.state.current;
    if (offset < 0 && this.state.list.length > 0) {
      const len = this.state.list.length;
      const idx = this._historyIndex(offset);
      const rec = this.state.list[idx];
      const keptCovers = offset === -1 && !!this._keptPrev && rec != null && this._keptUrl === rec.url;
      if (keptCovers) {
        shown = this._keptPrev;
      } else if (this.state.slot != null && this._slotRec != null && rec != null && this._slotRec.url === rec.url) {
        shown = this.state.slot;
      } else {
        shown = null;
      }
    }
    return (
      <div style={style}>
        {this.state.list.length === 0 && (
          <Container maxWidth={false}
            style={{height: '100%', zIndex: 3, flexGrow: 1, padding: 0, position: 'relative',
                    alignItems: 'center', justifyContent: 'center', display: 'flex'}}>
            <CircularProgress size={300}/>
          </Container>
        )}
        {shown && (
          <ImageView
            image={shown}
            currentAudio={this.props.currentAudio}
            scene={this.props.scene}
            config={this.props.config}
            fitParent={this.props.gridView}
            hasStarted={this.props.hasStarted}
            removeChild
            setVideo={this.props.setVideo}
          />
        )}
        {shown == null && this.props.scene.downloadScene && (
          <Container maxWidth={false}
            style={{height: '100%', zIndex: 3, flexGrow: 1, padding: 0, position: 'relative',
                    alignItems: 'center', justifyContent: 'center', display: 'flex'}}>
            <CircularProgress size={100}/>
            <Typography component="h6" color="inherit"
              style={{position: 'absolute', bottom: 40, color: '#fff'}}>
              Loading next…
            </Typography>
          </Container>
        )}
      </div>
    );
  }
}

(LiveShowPlayer as any).displayName = "LiveShowPlayer";
