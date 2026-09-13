import * as path from "path";
import wretch from "wretch";

import {IF, ST, WF} from "../../data/const";
import Config from "../../data/Config";
import LibrarySource from "../../data/LibrarySource";

const pm = (object: any, resolve?: Function) => {
  if (object?.source && object?.data && object?.allURLs && object?.weight && object?.helpers) {
    const source = object.source;
    if (source.blacklist && source.blacklist.length > 0) {
      object.data = object.data.filter((url: string) => !source.blacklist.includes(url));
    }
    object.allURLs = processAllURLs(object.data, object.allURLs, object.source, object.weight, object.helpers);
  }
  if (!!resolve) {
    resolve({data: object});
  }
}

export const processAllURLs = (data: string[], allURLs: Map<string, string[]>, source: LibrarySource, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}): Map<string, string[]> => {
  let newAllURLs = allURLs;
  if (helpers.next != null && helpers.next <= 0) {
    if (weight == WF.sources) {
      newAllURLs.set(source.url, data);
    } else {
      for (let d of data) {
        newAllURLs.set(d, [source.url]);
      }
    }
  } else {
    if (weight == WF.sources) {
      let sourceURLs = newAllURLs.get(source.url);
      if (!sourceURLs) sourceURLs = [];
      newAllURLs.set(source.url, sourceURLs.concat(data.filter((u: string) => {
        const fileName = getFileName(u);
        const found = sourceURLs.map((u: string) => getFileName(u)).includes(fileName);
        return !found;
      })));
    } else {
      for (let d of data.filter((u: string) => {
        const fileName = getFileName(u);
        const found = Array.from(newAllURLs.keys()).map((u: string) => getFileName(u)).includes(fileName);
        return !found;
      })) {
        newAllURLs.set(d, [source.url]);
      }
    }
  }
  return newAllURLs;
}

export const loadRemoteImageURLList = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const url = source.url;
  wretch(url)
    .get()
    .text(data => {
      const lines = data.match(/[^\r\n]+/g).filter((line) => line.startsWith("http://") || line.startsWith("https://") || line.startsWith("file:///"));
      if (lines.length > 0) {
        helpers.count = lines.length;
        pm({
          data: filterPathsToJustPlayable(filter, lines, true),
          allURLs: allURLs,
          allPosts: allPosts,
          weight: weight,
          helpers: helpers,
          source: source,
          timeout: 0,
        }, resolve);
      } else {
        pm({
          warning: "No lines in" + url + " are links or files",
          helpers: helpers,
          source: source,
          timeout: 0,
        }, resolve);
      }
    })
    .catch((e) => {
      pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: 0,
      }, resolve);
    });
}

// ===== Utility Functions =====

export function filterPathsToJustPlayable(imageTypeFilter: string, paths: Array<string>, strict: boolean): Array<string> {
  switch (imageTypeFilter) {
    default:
    case IF.any:
      return paths.filter((p) => isImageOrVideo(p, strict));
    case IF.stills:
    case IF.images:
      return paths.filter((p) => isImage(p, strict));
    case IF.animated:
      return paths.filter((p) => p.toLowerCase().endsWith('.gif') || isVideo(p, strict));
    case IF.videos:
      return paths.filter((p) => isVideo(p, strict));
  }
}

export const isImageOrVideo = (path: string, strict: boolean): boolean => {
  return (isImage(path, strict) || isVideo(path, strict));
}

export function isImage(path: string, strict: boolean): boolean {
  if (path == null) return false;
  const p = path.toLowerCase();
  const acceptableExtensions = [".gif", ".png", ".jpeg", ".jpg", ".webp", ".tiff", ".svg"];
  for (let ext of acceptableExtensions) {
    if (strict) {
      if (p.endsWith(ext)) return true;
    } else {
      if (p.includes(ext)) return true;
    }
  }
  return false;
}

export function isVideo(path: string, strict: boolean): boolean {
  if (path == null) return false;
  const p = path.toLowerCase();
  const acceptableExtensions = [".mp4", ".mkv", ".webm", ".ogv", ".mov", ".m4v"];
  for (let ext of acceptableExtensions) {
    if (strict) {
      if (p.endsWith(ext)) return true;
    } else {
      if (p.includes(ext)) return true;
    }
  }
  return false;
}

export function isVideoPlaylist(path: string, strict: boolean): boolean {
  if (path == null) return false;
  const p = path.toLowerCase();
  const acceptableExtensions = [".asx", ".m3u8", ".pls", ".xspf"];
  for (let ext of acceptableExtensions) {
    if (strict) {
      if (p.endsWith(ext)) return true;
    } else {
      if (p.includes(ext)) return true;
    }
  }
  return false;
}

export function isAudio(path: string, strict: boolean): boolean {
  if (path == null) return false;
  const p = path.toLowerCase();
  const acceptableExtensions = [".mp3", ".m4a", ".wav", ".ogg"];
  for (let ext of acceptableExtensions) {
    if (strict) {
      if (p.endsWith(ext)) return true;
    } else {
      if (p.includes(ext)) return true;
    }
  }
  return false;
}

export function getFileName(url: string, extension = true) {
  let sep;
  if (/^(https?:\/\/)|(file:\/\/)/g.exec(url) != null) {
    sep = "/"
  } else {
    sep = path.sep;
  }
  url = url.substring(url.lastIndexOf(sep) + 1);
  if (url.includes("?")) {
    url = url.substring(0, url.indexOf("?"));
  }
  if (!extension) {
    url = url.substring(0, url.lastIndexOf("."));
  }
  return url;
}

export function getSourceType(url: string): string {
  if (isAudio(url, false)) {
    return ST.audio;
  } else if (isVideo(url, false)) {
    return ST.video;
  } else if (isVideoPlaylist(url, true)) {
    return ST.playlist;
  } else if (/^https?:\/\/([^.]*|(66\.media))\.tumblr\.com/.exec(url) != null) {
    return ST.tumblr;
  } else if (/^https?:\/\/(www\.)?reddit\.com\//.exec(url) != null) {
    return ST.reddit;
  } else if (/^https?:\/\/(www\.)?redgifs\.com\//.exec(url) != null) {
    return ST.redgifs;
  } else if (/^https?:\/\/(www\.)?imagefap\.com\//.exec(url) != null) {
    return ST.imagefap;
  } else if (/^https?:\/\/(www\.)?imgur\.com\//.exec(url) != null) {
    return ST.imgur;
  } else if (/^https?:\/\/(www\.)?(cdn\.)?sex\.com\//.exec(url) != null) {
    return ST.sexcom;
  } else if (/^https?:\/\/(www\.)?twitter\.com\//.exec(url) != null) {
    return ST.twitter;
  } else if (/^https?:\/\/(www\.)?deviantart\.com\//.exec(url) != null) {
    return ST.deviantart;
  } else if (/^https?:\/\/(www\.)?instagram\.com\//.exec(url) != null) {
    return ST.instagram;
  } else if (/^https?:\/\/(www\.)?(lolibooru\.moe|hypnohub\.net|danbooru\.donmai\.us)\//.exec(url) != null) {
    return ST.danbooru;
  } else if (/^https?:\/\/(www\.)?(safebooru\.org)\//.exec(url) != null) {
    return ST.booruAPI;
  } else if (/^https?:\/\/(www\.)?(rule34\.xxx)\//.exec(url) != null) {
    return ST.rule34;
  } else if (/^https?:\/\/(www\.)?(e621\.net)\//.exec(url) != null) {
    return ST.e621;
  } else if (/^https?:\/\/(www\.|members\.)?luscious\.net\//.exec(url) != null) {
    return ST.luscious;
  } else if (/^https?:\/\/(www\.)?(.*\.booru\.org)\//.exec(url) != null) {
    return ST.booruScrape;
  } else if (/^https?:\/\/(www\.)?(gelbooru\.com)\//.exec(url) != null) {
    return ST.gelbooru;
  } else if (/^https?:\/\/(www\.)?e-hentai\.org\/g\//.exec(url) != null) {
    return ST.ehentai;
  } else if (/^https?:\/\/[^.]*\.bdsmlr\.com/.exec(url) != null) {
    return ST.bdsmlr;
  } else if (/^https?:\/\/[\w\\.]+:\d+\/get_files\/search_files/.exec(url) != null) {
    return ST.hydrus;
  } else if (/^https?:\/\/[^.]*\.[a-z0-9\.:]+\/ws.php/.exec(url) != null) {
    return ST.piwigo;
  } else if (/^https?:\/\/hypno\.nimja\.com\/visual\/\d+/.exec(url) != null) {
    return ST.nimja;
  } else if (/(^https?:\/\/)|(\.txt$)/.exec(url) != null) { // Arbitrary URL, assume image list
    return ST.list;
  } else { // Directory
    return ST.local;
  }
}

export function getFileGroup(url: string) {
  let sep;
  switch (getSourceType(url)) {
    case ST.tumblr:
      let tumblrID = url.replace(/https?:\/\//, "");
      tumblrID = tumblrID.replace(/\.tumblr\.com\/?/, "");
      return tumblrID;
    case ST.reddit:
      let redditID = url;
      if (redditID.endsWith("/")) redditID = redditID.slice(0, url.lastIndexOf("/"));
      if (redditID.endsWith("/saved")) redditID = redditID.replace("/saved", "");
      redditID = redditID.substring(redditID.lastIndexOf("/") + 1);
      return redditID;
    case ST.redgifs:
      let redgifID;
      if (url.includes("/browse?")) {
        let redgifRegex = /^https?:\/\/(?:www\.)?redgifs\.com\/browse\?.*tags=([^&]*)/.exec(url);
        return redgifRegex ? redgifRegex[1] : "all";
      } else if (url.includes("/users/")) {
        redgifID = url.replace(/^https?:\/\/(www\.)?redgifs\.com\/users\//, "");
        if (redgifID.includes("/")) {
          redgifID = redgifID.substring(0, redgifID.indexOf("/"));
        }
      }
      return redgifID ?? "";
    case ST.imagefap:
      let imagefapID = url.replace(/https?:\/\/www.imagefap.com\//, "");
      imagefapID = imagefapID.replace(/pictures\//, "");
      imagefapID = imagefapID.replace(/organizer\//, "");
      imagefapID = imagefapID.replace(/video\.php\?vid=/, "");
      imagefapID = imagefapID.split("/")[0];
      return imagefapID;
    case ST.sexcom:
      let sexcomID = url.replace(/https?:\/\/www.sex.com\//, "");
      sexcomID = sexcomID.replace(/user\//, "");
      sexcomID = sexcomID.split("?")[0];
      if (sexcomID.endsWith("/")) {
        sexcomID = sexcomID.substring(0, sexcomID.length - 1);
      }
      return sexcomID;
    case ST.imgur:
      let imgurID = url.replace(/https?:\/\/imgur.com\//, "");
      imgurID = imgurID.replace(/a\//, "");
      return imgurID;
    case ST.twitter:
      let twitterID = url.replace(/https?:\/\/twitter.com\//, "");
      if (twitterID.includes("?")) {
        twitterID = twitterID.substring(0, twitterID.indexOf("?"));
      }
      if (twitterID.endsWith("/")) {
        twitterID = twitterID.substring(0, twitterID.length - 1);
      }
      return twitterID;
    case ST.deviantart:
      let authorID = url.replace(/https?:\/\/www.deviantart.com\//, "");
      if (authorID.includes("/")) {
        authorID = authorID.substring(0, authorID.indexOf("/"));
      }
      return authorID;
    case ST.instagram:
      let instagramID = url.replace(/https?:\/\/www.instagram.com\//, "");
      if (instagramID.includes("/")) {
        instagramID = instagramID.substring(0, instagramID.indexOf("/"));
      }
      return instagramID;
    case ST.e621:
      const hostRegexE621 = /^https?:\/\/(?:www\.)?([^.]*)\./g;
      const hostE621 =  hostRegexE621.exec(url)[1];
      let E621ID = "";
      if (url.includes("/pools/")) {
        E621ID = "pool" + url.substring(url.lastIndexOf("/"));
      } else {
        const tagRegex = /[?&]tags=([^&]*)/g;
        let tags;
        if ((tags = tagRegex.exec(url)) !== null) {
          E621ID = tags[1];
        }
        if (E621ID.endsWith("+")) {
          E621ID = E621ID.substring(0, E621ID.length - 1);
        }
      }
      return hostE621 + "/" + decodeURIComponent(E621ID);
    case ST.luscious:
      let albumID = url.replace(/^https?:\/\/(www\.|members\.)?luscious\.net\/(albums|users)\//, "");
      if (albumID.includes("/")) {
        albumID = albumID.substring(0, albumID.indexOf("/"));
      }
      return albumID;
    case ST.danbooru:
    case ST.booruScrape:
    case ST.booruAPI:
      const hostRegex = /^https?:\/\/(?:www\.)?([^.]*)\./g;
      const host =  hostRegex.exec(url)[1];
      let danbooruID = "";
      if (url.includes("/pools/")) {
        danbooruID = "pools/" + url.substring(url.lastIndexOf("/"));
      } else if (url.includes("/favorite_groups/")) {
        danbooruID = "favorite_groups/" + url.substring(url.lastIndexOf("/"));
      } else {
        const tagRegex = /[?&]tags=([^&]*)/g;
        let tags;
        if ((tags = tagRegex.exec(url)) !== null) {
          let sanitizedTags = tags[1];
          sanitizedTags = sanitizedTags.replace("%3A", "");
          danbooruID = sanitizedTags;
        }
        const titleRegex = /[?&]title=(.*)&?/g;
        let title;
        if ((title = titleRegex.exec(url)) !== null) {
          if (tags == null) {
            danbooruID = ""
          } else if (!danbooruID.endsWith("+")) {
            danbooruID += "+";
          }
          danbooruID += title[1];
        }
        if (danbooruID.endsWith("+")) {
          danbooruID = danbooruID.substring(0, danbooruID.length - 1);
        }
      }
      return host + "/" + decodeURIComponent(danbooruID);
    case ST.rule34:
    case ST.gelbooru:
      let rule34 = "";
      const r34tagRegex = /[?&]tags=([^&]*)/g;
      let r34Tags;
      if ((r34Tags = r34tagRegex.exec(url)) !== null) {
        let sanitizedTags = r34Tags[1];
        sanitizedTags = sanitizedTags.replace("%3A", "").replace("%3a", "");
        rule34 = sanitizedTags;
      }
      if (rule34.endsWith("+")) {
        rule34 = rule34.substring(0, rule34.length - 1);
      }
      return decodeURIComponent(rule34);
    case ST.ehentai:
      const galleryRegex = /^https?:\/\/(?:www\.)?e-hentai\.org\/g\/([^\/]*)/g;
      const gallery = galleryRegex.exec(url);
      return gallery ? gallery[1] : "";
    case ST.list:
      if (/^https?:\/\//g.exec(url) != null) {
        sep = "/"
      } else {
        sep = path.sep;
      }
      return url.substring(url.lastIndexOf(sep) + 1).replace(".txt", "");
    case ST.local:
      if (url.endsWith(path.sep)) {
        url = url.substring(0, url.length - 1);
        return url.substring(url.lastIndexOf(path.sep)+1);
      } else {
        return url.substring(url.lastIndexOf(path.sep)+1);
      }
    case ST.video:
    case ST.playlist:
    case ST.nimja:
      if (/^https?:\/\//g.exec(url) != null) {
        sep = "/"
      } else {
        sep = path.sep;
      }
      let name = url.substring(0, url.lastIndexOf(sep));
      return name.substring(name.lastIndexOf(sep)+1);
    case ST.bdsmlr:
      let bdsmlrID = url.replace(/https?:\/\//, "");
      bdsmlrID = bdsmlrID.replace(/\/rss/, "");
      bdsmlrID = bdsmlrID.replace(/\.bdsmlr\.com\/?/, "");
      return bdsmlrID;
    case ST.hydrus:
      const tagsRegex = /tags=([^&]*)&?.*$/.exec(url);
      if (tagsRegex == null) return "hydrus";
      let hydrusTags = tagsRegex[1];
      if (!hydrusTags.startsWith("[")) {
        hydrusTags = decodeURIComponent(hydrusTags);
      }
      hydrusTags = hydrusTags.substring(1, hydrusTags.length - 1);
      hydrusTags = hydrusTags.replace(/"/g, "");
      return hydrusTags;
    case ST.piwigo:
      const catRegex = /cat_id\[]=(\d*)/.exec(url);
      if (catRegex != null) return catRegex[1];

      const piwigoTagRegex = /tag_id\[]=(\d*)/.exec(url);
      if (piwigoTagRegex != null) return piwigoTagRegex[1];

      return "piwigo";
    default:
      return url;
  }
}

export { pm };
