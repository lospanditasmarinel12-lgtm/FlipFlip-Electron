/**
 * Pure helper for "Live Show" playback mode.
 *
 * Classic playback preloads N images/videos into a ready queue and keeps a
 * history for back/forth. Live Show mode instead builds a plain ordered list of
 * media URLs ONCE and plays them one at a time — the currently-displayed element
 * is the only decoded media in existence, and it is torn down immediately on
 * advance.
 *
 * This module only computes the display list; it never touches the DOM or
 * allocates media elements.
 */

import {OF, SOF, ST, WF} from "./const";
import Scene from "./Scene";
import {filterPathsToJustPlayable, getSourceType} from "../components/player/Scrapers";

export interface LiveShowItem {
  url: string;
  source: string;
  post: string | null;
  index: number;
  length: number;
  sindex: number | null;
}

/**
 * Build the ordered display list for a scene from its allURLs/allPosts maps.
 * Uses the same *ordering* semantics as the classic fetch loop (source ordering,
 * weights, per-source ordered-or-random) but produces a flat list rather than a
 * streaming iterator, so Live Show can just walk `list[index % list.length]`.
 */
export function buildLiveShowList(
  scene: Scene,
  allURLs: Map<string, Array<string>>,
  allPosts: Map<string, string>,
): Array<LiveShowItem> {
  const items: Array<LiveShowItem> = [];
  const urlKeys = Array.from(allURLs.keys());

  if (!scene || urlKeys.length === 0) return items;

  let sourceOrder: Array<string> = [];

  if (scene.weightFunction == WF.sources) {
    if (scene.useWeights) {
      const validKeys = new Set(urlKeys);
      for (const source of scene.sources) {
        if (validKeys.has(source.url)) {
          for (let w = source.weight; w > 0; w--) {
            sourceOrder.push(source.url);
          }
        }
      }
      if (sourceOrder.length === 0) sourceOrder = urlKeys.slice();
    } else {
      sourceOrder = urlKeys.slice();
    }

    if (scene.sourceOrderFunction == SOF.random) {
      sourceOrder = randomize(sourceOrder);
    }
  } else {
    // Image-weighted: every KEY in allURLs IS a media URL, and each VALUE is
    // the [source url] that produced it. Play the keys — exactly like the
    // classic fetch loop flattens allURLs.keys() (see ImagePlayer). Never play
    // the value: for a local directory source the value is the directory path,
    // and <img>/<video> would try to stream a folder (flipflip:// ERR_UNEXPECTED).
    let mediaKeys = urlKeys.slice();
    if (scene.orderFunction == OF.random) {
      mediaKeys = randomize(mediaKeys);
    }

    const length = mediaKeys.length;
    for (let i = 0; i < mediaKeys.length; i++) {
      const mediaURL = mediaKeys[i];
      const sources = allURLs.get(mediaURL) || [];

      // Nimja pages are HTML and handled separately (iframe). Everything else
      // must pass the scene's image filter — the same filter the classic fetch
      // loop applies via filterPathsToJustPlayable. Directories and unknown
      // files (e.g. an "Images/jpeg" folder) are rejected here.
      if (getSourceType(mediaURL) != ST.nimja &&
        filterPathsToJustPlayable(scene.imageTypeFilter, [mediaURL], true).length === 0) {
        continue;
      }

      items.push({
        url: mediaURL,
        source: sources[0] ?? "",
        post: allPosts.has(mediaURL) ? allPosts.get(mediaURL) : null,
        index: i,
        length,
        sindex: null,
      });
    }

    return items;
  }

  // De-duplicate sources (weighted lists repeat them)
  sourceOrder = Array.from(new Set(sourceOrder));

  for (const source of sourceOrder) {
    let collection = (allURLs.get(source) || []).slice();
    if (collection.length === 0) continue;

    if (scene.orderFunction == OF.random) {
      collection = randomize(collection);
    }

    for (let i = 0; i < collection.length; i++) {
      const url = collection[i];
      let post: string | null = null;
      if (allPosts.has(url)) post = allPosts.get(url);

      // Nimja pages are handled separately; everything else must pass the
      // scene's image filter (directories / unknown files are rejected).
      if (getSourceType(url) != ST.nimja &&
        filterPathsToJustPlayable(scene.imageTypeFilter, [url], true).length === 0) {
        continue;
      }

      items.push({
        url,
        source,
        post,
        index: i,
        length: collection.length,
        sindex: sourceOrder.length > 1 ? sourceOrder.indexOf(source) : null,
      });
    }
  }

  // Single global shuffle (Fisher-Yates over the whole list) so random playback
  // isn't grouped by source. Per-source randomization already happened above;
  // this guarantees cross-source mixing as well.
  if (scene.orderFunction == OF.random) {
    const shuffled = randomize(items);
    items.splice(0, items.length, ...shuffled);
  }

  return items;
}

function randomize<T>(list: Array<T>): Array<T> {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
