import * as React from 'react';
import * as fs from "fs";
import recursiveReaddir from "recursive-readdir";
import fileURL from "file-url";
import wretch from "wretch";

import {Dialog, DialogContent} from "@mui/material";

import {CancelablePromise, deepClone, flatten, getCachePath, randomizeList, urlToPath} from "../../data/utils";
import {
  filterPathsToJustPlayable, getFileName, getSourceType, isVideo, loadRemoteImageURLList,
  processAllURLs
} from "./Scrapers";
import {IF, SOF, ST} from '../../data/const';
import Config from "../../data/Config";
import LibrarySource from "../../data/LibrarySource";
import Scene from '../../data/Scene';
import Audio from "../../data/Audio";
import ChildCallbackHack from './ChildCallbackHack';
import LiveShowPlayer from './LiveShowPlayer';
import * as booruLoaders from './scrapers/booru';
import * as otherLoaders from './scrapers/other';

// Returns true if array is empty, or only contains empty arrays
function isEmpty(allURLs: any[]): boolean {
  return Array.isArray(allURLs) && allURLs.every(isEmpty);
}

// Determine what kind of source we have based on the URL and return associated Promise.
// Non-worker dispatch. Remote paging sources only wire the still-working, non-OAuth
// loaders (port of Capacitor's scraper set); sources without a loader resolve empty.
function scrapeFiles(allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}) {
  const sourceType = getSourceType(source.url);
  if (sourceType == ST.local) { // Local files
    return new CancelablePromise((resolve) => {
      loadLocalDirectory(resolve, allURLs, allPosts, config, source, filter, weight, helpers, null);
    });
  } else if (sourceType == ST.list) { // Image List
    helpers.next = null;
    return new CancelablePromise((resolve) => {
      loadRemoteImageURLList(allURLs, allPosts, config, source, filter, weight, helpers, resolve);
    });
  } else if (sourceType == ST.video) {
    const cachePath = getCachePath(source.url, config) + getFileName(source.url);
    return new CancelablePromise((resolve) => {
      loadVideo(resolve, allURLs, allPosts, config, source, filter, weight, helpers, config.caching.enabled && fs.existsSync(cachePath) ? cachePath : null);
    });
  } else if (sourceType == ST.playlist) {
    const cachePath = getCachePath(source.url, config) + getFileName(source.url);
    return new CancelablePromise((resolve) => {
      loadPlaylist(resolve, allURLs, allPosts, config, source, filter, weight, helpers, config.caching.enabled && fs.existsSync(cachePath) ? cachePath : null);
    });
  } else if (sourceType == ST.nimja) {
    return new CancelablePromise((resolve) => {
      loadNimja(resolve, allURLs, allPosts, config, source, filter, weight, helpers, null);
    });
  } else { // Remote paging sources
    let remoteLoader: Function = null;
    switch (sourceType) {
      case ST.danbooru:      remoteLoader = booruLoaders.loadDanbooru; break;
      case ST.e621:          remoteLoader = booruLoaders.loadE621; break;
      case ST.booruScrape:   remoteLoader = booruLoaders.loadBooruScrape; break;
      case ST.booruAPI:      remoteLoader = booruLoaders.loadBooruAPI; break;
      case ST.gelbooru:      remoteLoader = booruLoaders.loadGelbooru; break;
      case ST.rule34:        remoteLoader = booruLoaders.loadRule34; break;
      case ST.ehentai:       remoteLoader = otherLoaders.loadEHentai; break;
      case ST.luscious:      remoteLoader = otherLoaders.loadLuscious; break;
      case ST.bdsmlr:        remoteLoader = otherLoaders.loadBDSMlr; break;
      case ST.hydrus:        remoteLoader = otherLoaders.loadHydrus; break;
      case ST.piwigo:        remoteLoader = otherLoaders.loadPiwigo; break;
      default:               remoteLoader = null; break;
    }

    if (remoteLoader == null) {
      return new CancelablePromise((resolve) => {
        resolve({data: [], helpers: helpers});
      });
    }

    if (helpers.next == -1) {
      helpers.next = 0;
      const cachePath = getCachePath(source.url, config);
      if (config.caching.enabled && fs.existsSync(cachePath) && fs.readdirSync(cachePath).length > 0) {
        helpers.next = null;
        return new CancelablePromise((resolve) => {
          loadLocalDirectory(resolve, allURLs, allPosts, config, source, filter, weight, helpers, cachePath);
        });
      }
    }
    return new CancelablePromise((resolve) => {
      remoteLoader(allURLs, allPosts, config, source, filter, weight, helpers, resolve);
    });
  }
}

const loadNimja = (pm: Function, allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, cachePath: string) => {
  let sources = [source.url];
  allURLs = processAllURLs(sources, allURLs, source, weight, helpers);
  helpers.next = null;
  pm({data: {
      data: sources,
      allURLs: allURLs, 
      allPosts: allPosts,
      weight: weight,
      helpers: helpers,
      source: source,
      timeout: 0,
    }});
}

const loadLocalDirectory = (pm: Function, allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, cachePath: string) => {
  const blacklist = ['*.css', '*.html', 'avatar.png', '*.txt'];
  const url = cachePath ? cachePath : source.url;

  recursiveReaddir(url, blacklist, (err: any, rawFiles: Array<string>) => {
    if (err) {
      pm({data: {
        error: err.message,
        helpers: helpers,
        source: source,
        timeout: 0,
      }});
    } else {
      const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
      let sources = filterPathsToJustPlayable(filter, rawFiles, true).map((p) => fileURL(p)).sort(collator.compare);

      if (source.blacklist && source.blacklist.length > 0) {
        sources = sources.filter((url: string) => !source.blacklist.includes(url) && !source.blacklist.includes(urlToPath(url)));
      }
      allURLs = processAllURLs(sources, allURLs, source, weight, helpers);
      // If this is a local source (not a cacheDir call)
      if (helpers.next == -1) {
        helpers.count = filterPathsToJustPlayable(IF.any, rawFiles, true).length;
        helpers.next = null;
      }

      pm({data: {
        data: sources,
        allURLs: allURLs, 
        allPosts: allPosts,
        weight: weight,
        helpers: helpers,
        source: source,
        timeout: 0,
      }});
    }
  });
}

export const loadVideo = (pm: Function, allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, cachePath: string) => {
  const url = cachePath ? cachePath : source.url;
  const missingVideo = () => {
    pm({data: {
      error: "Could not find " + source.url,
      data: [],
      allURLs: allURLs, 
      allPosts: allPosts,
      weight: weight,
      helpers: helpers,
      source: source,
      timeout: 0,
    }});
  }
  const ifExists = (url: string) => {
    if (!url.startsWith("http")) {
      url = fileURL(url);
    }
    helpers.count = 1;

    let paths;
    if (source.clips && source.clips.length > 0) {
      const clipPaths = Array<string>();
      for (let clip of source.clips) {
        if (!source.disabledClips || !source.disabledClips.includes(clip.id)) {
          let clipPath = url + ":::" + clip.id + ":" + (clip.volume != null ? clip.volume : "-") + ":::" + clip.start + ":" + clip.end;
          if (source.subtitleFile != null && source.subtitleFile.length > 0) {
            clipPath = clipPath + "|||" + source.subtitleFile;
          }
          clipPaths.push(clipPath);
        }
      }
      paths = clipPaths;
    } else {
      if (source.subtitleFile != null && source.subtitleFile.length > 0) {
        url = url + "|||" + source.subtitleFile;
      }
      paths = [url];
    }

    if (source.blacklist && source.blacklist.length > 0) {
      paths = paths.filter((url: string) => !source.blacklist.includes(url));
    }
    allURLs = processAllURLs(paths, allURLs, source, weight, helpers);
    helpers.next = null;

    pm({data: {
      data: paths,
      allURLs: allURLs, 
      allPosts: allPosts,
      weight: weight,
      helpers: helpers,
      source: source,
      timeout: 0,
    }});
  }

  if (!isVideo(url, false)) {
    missingVideo();
  }
  if (url.startsWith("http")) {
    wretch(url)
      .get()
      .notFound((e) => {
        missingVideo();
      })
      .res((r) => {
        ifExists(url);
      })
  } else {
    const exists = fs.existsSync(url);
    if (exists) {
      ifExists(url);
    } else {
      missingVideo();
    }
  }
}

export const loadPlaylist = (pm: Function, allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, cachePath: string) => {
  const url = cachePath ? cachePath : source.url;
  wretch(url)
    .get()
    .text(data => {
      let urls = [];
      if (url.endsWith(".asx")) {
        const refs = new DOMParser().parseFromString(data, "text/xml").getElementsByTagName("Ref");
        for (let r = 0; r < refs.length; r++) {
          const l = refs[r];
          urls.push(l.getAttribute("href"));
        }
      } else if (url.endsWith(".m3u8")) {
        for (let l of data.split("\n")) {
          if (l.length > 0 && !l.startsWith("#")) {
            urls.push(l.trim());
          }
        }
      } else if (url.endsWith(".pls")) {
        for (let l of data.split("\n")) {
          if (l.startsWith("File")) {
            urls.push(l.split("=")[1].trim());
          }
        }
      } else if (url.endsWith(".xspf")) {
        const locations = new DOMParser().parseFromString(data, "text/xml").getElementsByTagName("location");
        for (let r = 0; r < locations.length; r++) {
          const l = locations[r];
          urls.push(l.textContent);
        }
      }

      if (urls.length > 0) {
        helpers.count = urls.length;
      }

      urls = filterPathsToJustPlayable(filter, urls, true);

      if (source.blacklist && source.blacklist.length > 0) {
        urls = urls.filter((url: string) => !source.blacklist.includes(url));
      }
      allURLs = processAllURLs(urls, allURLs, source, weight, helpers);
      helpers.next = null;

      pm({data: {
        data: urls,
        allURLs: allURLs,
        allPosts: allPosts,
        weight: weight,
        helpers: helpers,
        source: source,
        timeout: 0,
      }});
    })
    .catch((e) => {
      pm({data: {
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: 0,
      }});
    });
}


export default class SourceScraper extends React.Component {
  readonly props: {
    config: Config,
    scene: Scene,
    currentAudio: Audio,
    opacity: number,
    isPlaying: boolean,
    gridView: boolean,
    hasStarted: boolean,
    historyOffset: number,
    advanceHack: ChildCallbackHack,
    deleteHack?: ChildCallbackHack,
    gridCoordinates?: Array<number>,
    isOverlay?: boolean,
    nextScene?: Scene,
    strobeLayer?: string,
    setHistoryOffset(historyOffset: number): void,
    setHistoryPaths(historyPaths: Array<any>): void,
    firstImageLoaded(): void,
    finishedLoading(empty: boolean): void,
    setProgress(total: number, current: number, message: string[]): void,
    setVideo(video: HTMLVideoElement): void,
    setCount(sourceURL: string, count: number, countComplete: boolean): void,
    cache(i: HTMLImageElement | HTMLVideoElement): void,
    systemMessage(message: string): void,
    onEndScene?(): void,
    setTimeToNextFrame?(timeToNextFrame: number): void,
    setSceneCopy?(children: React.ReactNode): void,
    playNextScene?(): void,
  };

  readonly state = {
    allURLs: new Map<string, Array<string>>(),
    allPosts: new Map<string, string>(),
    restart: false,
    preload: false,
    videoVolume: this.props.scene.videoVolume,
    captcha: null as any,
    load: false,
    singleImage: null as number,
  };

  _isMounted = false;
  _backForth: NodeJS.Timeout = null;
  _promiseQueue: Array<{source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string}}> = null;
  _nextPromiseQueue: Array<{source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string}}> = null;
  _nextAllURLs: Map<string, Array<string>> = null;
  _nextAllPosts: Map<string, string> = null;
  _pendingURLBatch: Array<{allURLs: any, allPosts: any}> = [];
  _batchTimer: ReturnType<typeof setTimeout> | null = null;

  _queueURLUpdate(update: {allURLs: any, allPosts: any}): void {
    this._pendingURLBatch.push(update);
    if (!this._batchTimer) {
      this._batchTimer = setTimeout(() => {
        this._flushURLBatch();
        this._batchTimer = null;
      }, 200);
    }
  }

  _flushURLBatch(): void {
    if (this._pendingURLBatch.length === 0) return;
    const merged = this._pendingURLBatch.reduce((acc, update) => {
      if (update.allURLs != null) acc.allURLs = update.allURLs;
      if (update.allPosts != null) acc.allPosts = update.allPosts;
      return acc;
    }, { allURLs: null, allPosts: null } as any);
    this._pendingURLBatch = [];
    this.setState({ allURLs: merged.allURLs ? new Map(merged.allURLs) : null, allPosts: merged.allPosts ? new Map(merged.allPosts) : null });
  }

  render() {
    let style: any = {opacity: this.props.opacity};
    if (this.props.gridView) {
      style = {
        ...style,
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: this.props.isOverlay ? 4 : 'auto',
      }
    }
    return (
      <div style={style}>

        {this.state.allURLs.size > 0 && this.state.restart == false && (
          <LiveShowPlayer
            key={`live-${this.props.scene.id}`}
            config={this.props.config}
            scene={this.props.scene}
            currentAudio={this.props.currentAudio}
            gridView={this.props.gridView}
            isPlaying={this.props.isPlaying}
            hasStarted={this.props.hasStarted}
            isOverlay={this.props.isOverlay}
            advanceHack={this.props.advanceHack}
            historyOffset={this.props.historyOffset}
            setHistoryOffset={this.props.setHistoryOffset}
            setHistoryPaths={this.props.setHistoryPaths}
            allURLs={this.state.allURLs}
            allPosts={this.state.allPosts}
            onLoaded={this.props.firstImageLoaded.bind(this)}
            setVideo={this.props.setVideo}
            onEndScene={this.props.onEndScene}
            setTimeToNextFrame={this.props.setTimeToNextFrame}/>
        )}
        {this.state.captcha != null && (
          <Dialog
            open={true}
            onClose={this.onCloseDialog.bind(this)}>
            <DialogContent style={{height: 600}}>
              <iframe sandbox="allow-forms" src={this.state.captcha.captcha} height={"100%"} onLoad={this.onIFrameLoad.bind(this)}/>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  onIFrameLoad() {
    if (!this.state.load) {
      this.setState({load: true});
    } else {
      this.onCloseDialog();
    }
  }

  onCloseDialog() {
    this.setState({captcha: null, load: false});
  }

  componentDidMount(restart = false) {
    this._isMounted = true;
    if (!restart) {
      this._promiseQueue = new Array<{ source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string} }>();
      this._nextPromiseQueue = new Array<{ source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string} }>();
      this._nextAllURLs = new Map<string, Array<string>>();
      this._nextAllPosts = new Map<string, string>();
    }
    let n = 0;
    let newAllURLs = new Map<string, Array<string>>();
    if (this.state.allURLs.size > 0) {
      newAllURLs = this.state.allURLs;
    }
    let newAllPosts = new Map<string, string>();
    if (this.state.allPosts.size > 0) {
      newAllPosts = this.state.allPosts;
    }

    // Scan each source recursively as a whole (the list builder flattens every
    // media file), so the entire folder — including files directly in the root —
    // is included. dirOfSources historically split folders into per-subdirectory
    // sources, which dropped root-level files; LiveShow doesn't need that split.
    let sceneSources = new Array<LibrarySource>();
    for (let source of this.props.scene.sources) {
      sceneSources.push(source);
    }

    const sources = this.props.scene.sourceOrderFunction == SOF.random ?
      randomizeList(deepClone(sceneSources)) :
      deepClone(sceneSources);

    let nextSources = new Array<LibrarySource>();
    if (this.props.nextScene) {
      let nextSceneSources = new Array<LibrarySource>();
      for (let source of this.props.nextScene.sources) {
        nextSceneSources.push(source);
      }
      nextSources = this.props.nextScene.sourceOrderFunction == SOF.random ?
        randomizeList(deepClone(nextSceneSources)) :
        deepClone(nextSceneSources);
    }

    let sourceLoop = () => {
      if (!this._isMounted || sceneSources.length == 0 || n >= sources.length) return;

      const d = sources[n];

      let message = d ? [d.url] : [""];
      if (this.props.isOverlay) {
        message = ["Loading '" + this.props.scene.name + "'...", message];
      }
      this.props.setProgress(sceneSources.length, n+1, message);

      if (!this.props.scene.playVideoClips && d.clips) {
        d.clips = [];
      }

      const receiveMessage = (message: any) => {
        let object = message.data;

        if (object?.captcha != null && this.state.captcha == null) {
          this.setState({captcha: {captcha: object.captcha, source: object?.source, helpers: object?.helpers}});
        }

        if (object?.error != null) {
          console.error("Error retrieving " + object?.source?.url + (object?.helpers?.next > 0 ? " Page " + object.helpers.next : ""));
          console.error(object.error);
        }

        if (object?.warning != null) {
          console.warn(object.warning);
        }

        if (object?.systemMessage != null) {
          this.props.systemMessage(object.systemMessage);
        }

        if (object?.source) {
          n += 1;

          // Just add the new urls to the end of the list
          if (object?.data && object?.allURLs) {
            const source = object.source;
            newAllURLs = object.allURLs;
            newAllPosts = object.allPosts;
            this._queueURLUpdate({allURLs: newAllURLs, allPosts: newAllPosts});

            // If this is a remote URL, queue up the next promise
            if (object.helpers.next != null) {
              this._promiseQueue.push({source: source, helpers: object.helpers});
            }
            this.props.setCount(source.url, object.helpers.count, object.helpers.next == null);
          }

          if (n < sceneSources.length) {
            const timeout = object?.timeout != null ? object.timeout : 1000;
            if (timeout == 0) {
              setImmediate(sourceLoop);
            } else {
              setTimeout(sourceLoop, timeout);
            }
          } else {
            const values = flatten(Array.from(newAllURLs.values()));
            if (!this._promiseQueue || this._promiseQueue.length == 0) {
              this.setState({singleImage: values.length == 1});
            }
            this.props.finishedLoading(isEmpty(values));
            promiseLoop();
            if (this.props.nextScene && this.props.playNextScene) {
              n = 0;
              nextSourceLoop();
            }
          }
        }
      }

      scrapeFiles(this.state.allURLs, this.state.allPosts, this.props.config, d, this.props.scene.imageTypeFilter, this.props.scene.weightFunction, {next: -1, count: 0, retries: 0, uuid: ""}).then((data) => {
        receiveMessage(data);
      });

    };

    let nextSourceLoop = () => {
      if (!this._isMounted) return;

      const d = nextSources[n];
      if (!this.props.nextScene.playVideoClips && d.clips) {
        d.clips = [];
      }

      const receiveMessage = (message: any) => {
        let object = message.data;

        if (object?.error != null) {
          console.error("Error retrieving " + object?.source?.url + (object?.helpers?.next > 0 ? " Page " + object.helpers.next : ""));
          console.error(object.error);
        }

        if (object?.warning != null) {
          console.warn(object.warning);
        }

        if (object?.systemMessage != null) {
          this.props.systemMessage(object.systemMessage);
        }

        if (object?.source) {
          n += 1;

          // Just add the new urls to the end of the list
          if (object?.data != null) {
            const source = object.source;
            this._nextAllURLs = object.allURLs;
            this._nextAllPosts = object.allPosts;

            // If this is a remote URL, queue up the next promise
            if (object.helpers.next != null) {
              this._nextPromiseQueue.push({source: source, helpers: object.helpers});
            }
            this.props.setCount(source.url, object.helpers.count, object.helpers.next == null);
          }

          if (n < nextSources.length) {
            setTimeout(nextSourceLoop, object.timeout != null ? object.timeout : 1000);
          }
        }
      }

      scrapeFiles(this._nextAllURLs, this._nextAllPosts, this.props.config, d, this.props.nextScene.imageTypeFilter, this.props.nextScene.weightFunction, {next: -1, count: 0, retries: 0, uuid: ""}).then((data) => {
        receiveMessage(data);
      });
    };

    let promiseLoop = () => {
      if (this.state.captcha != null && this._promiseQueue && this._promiseQueue.length == 0) {
        setTimeout(promiseLoop, 2000);
      }
      // Process until queue is empty or player has been stopped
      if (!this._isMounted || !this._promiseQueue || this._promiseQueue.length == 0)  {
        return;
      }

      const receiveMessage = (message: any) => {
        let object = message.data;

        if (object?.captcha != null && this.state.captcha == null) {
          this.setState({captcha: {captcha: object.captcha, source: object?.source, helpers: object?.helpers}});
        }

        if (object?.error != null) {
          console.error("Error retrieving " + object?.source?.url + (object?.helpers?.next > 0 ? " Page " + object.helpers.next : ""));
          console.error(object.error);
        }

        if (object?.warning != null) {
          console.warn(object.warning);
        }

        if (object?.systemMessage != null) {
          this.props.systemMessage(object.systemMessage);
        }

        // If we are not at the end of a source
        if (object?.source) {
          if (object?.data) {
            const source = object.source;
            this._queueURLUpdate({allURLs: object.allURLs, allPosts: object.allPosts});

            // Add the next promise to the queue
            if (object.helpers.next != null) {
              this._promiseQueue.push({source: source, helpers: object.helpers});
            }
            this.props.setCount(source.url, object.helpers.count, object.helpers.next == null);
          }

          setTimeout(promiseLoop, object?.timeout != null ? object.timeout : 1000);
        }
      }

      const promiseData = this._promiseQueue.shift();
      scrapeFiles(this.state.allURLs, this.state.allPosts, this.props.config, promiseData.source, this.props.scene.imageTypeFilter, this.props.scene.weightFunction, promiseData.helpers).then((data) => {
        receiveMessage(data);
      });
    };

    if (this.state.preload) {
      this.setState({preload: false});
      promiseLoop();
      if (this.props.nextScene && isEmpty(Array.from(this._nextAllURLs.values()))) {
        n = 0;
        nextSourceLoop();
      }
    } else {
      sourceLoop();
    }
  }

  shouldComponentUpdate(props: any, state: any): boolean {
    return props.scene !== this.props.scene ||
      (props.nextScene && this.props.nextScene &&
      props.nextScene.id !== this.props.nextScene.id) ||
      props.historyOffset !== this.props.historyOffset ||
      props.isPlaying !== this.props.isPlaying ||
      props.opacity !== this.props.opacity ||
      props.strobeLayer !== this.props.strobeLayer ||
      props.hasStarted !== this.props.hasStarted ||
      props.gridView !== this.props.gridView ||
      state.captcha !== this.state.captcha ||
      state.restart !== this.state.restart ||
      state.allURLs != this.state.allURLs ||
      state.allPosts != this.state.allPosts;
  }

  componentDidUpdate(props: any, state: any) {
    if (this.props.scene.videoVolume !== this.state.videoVolume) {
      this.setState({videoVolume: this.props.scene.videoVolume});
    }
    if (props.scene.id !== this.props.scene.id) {
      if (props.nextScene != null && this.props.scene.id === props.nextScene.id) { // If the next scene has been played
        if (this.props.nextScene && this.props.nextScene.id === props.scene.id) { // Just swap values if we're coming back to this scene again
          const newAllURLs = this._nextAllURLs;
          const newAllPosts = this._nextAllPosts;
          const temp = this._nextPromiseQueue;
          this._nextPromiseQueue = this._promiseQueue;
          this._promiseQueue = temp;
          this._nextAllURLs = state.allURLs;
          this._nextAllPosts = state.allPosts;
          this.setState({
            allURLs: newAllURLs,
            allPosts: newAllPosts,
            preload: true,
            restart: true,
            singleImage: null,
          });
        } else { // Replace values
          this._promiseQueue = this._nextPromiseQueue;
          this.setState({
            allURLs: this._nextAllURLs,
            allPosts: this._nextAllPosts,
            preload: true,
            restart: true,
            singleImage: null,
          });
          this._nextPromiseQueue = Array<{source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string}}>();
          this._nextAllURLs = new Map<string, Array<string>>();
          this._nextAllPosts = new Map<string, string>();
        }
      } else {
        this._promiseQueue = Array<{ source: LibrarySource, helpers: {next: any, count: number, retries: number, uuid: string}}>();
        this.setState({
          allURLs: new Map<string, Array<string>>(),
          allPosts: new Map<string, string>(),
          preload: false,
          restart: true,
          singleImage: null,
        });
      }
    }
    if (this.state.restart == true) {
      this.setState({restart: false});
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._promiseQueue = null;
    this._nextPromiseQueue = null;
    this._nextAllURLs = null;
    this._nextAllPosts = null;
    clearTimeout(this._backForth);
    this._backForth = null;
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    this._flushURLBatch();
  }
}

(SourceScraper as any).displayName="SourceScraper";