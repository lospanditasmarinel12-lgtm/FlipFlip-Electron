import wretch from "wretch";
import {DOMParser} from "@xmldom/xmldom";

import {IF} from "../../../data/const";
import Config from "../../../data/Config";
import LibrarySource from "../../../data/LibrarySource";
import { pm, processAllURLs, filterPathsToJustPlayable, getSourceType, getFileGroup, getFileName, isImageOrVideo, isImage, isVideo } from "../Scrapers";

// Ported from Flip-Electron src/renderer/components/player/Scrapers.ts
// Electron-only dependencies neutralized:
// - domino.createWindow(html).document.querySelectorAll(...) has no @xmldom/xmldom
//   equivalent (that lib implements no querySelectorAll), so eHentai/BDSMlr parsing
//   is rewritten with DOMParser + manual DOM traversal helpers below.

// @xmldom/xmldom implements no querySelectorAll, so emulate `#gdt > .gdtm > div > a`
// via traversal: each thumbnail tile wraps its image-page link in <div class="gdtm">.
const parseEHentaiThumbLinks = (html: string): Array<any> => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [];
  const anchors = doc.getElementsByTagName("a");
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors.item(i);
    const div = a.parentNode as any;
    if (!div || div.nodeName.toLowerCase() != "div") continue;
    const gdtm = div.parentNode as any;
    if (!gdtm || !(gdtm.getAttribute("class") || "").split(/\s+/).includes("gdtm")) continue;
    const gdt = gdtm.parentNode as any;
    if (!gdt || gdt.getAttribute("id") != "gdt") continue;
    links.push(a);
  }
  return links;
};

// @xmldom/xmldom implements no querySelectorAll, so emulate `item > description > img`
// (the embedded <img>s inside each RSS <item>'s <description>) via traversal.
const parseBDSMlrDescriptionImages = (xml: string): Array<any> => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const images = [];
  const items = doc.getElementsByTagName("item");
  for (let i = 0; i < items.length; i++) {
    const descriptions = (items.item(i) as any).getElementsByTagName("description");
    if (descriptions.length == 0) continue;
    const imgs = descriptions.item(0).getElementsByTagName("img");
    for (let j = 0; j < imgs.length; j++) {
      images.push(imgs.item(j));
    }
  }
  return images;
};

export const loadEHentai = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  wretch(url + "?p=" + (helpers.next + 1))
    .get()
    .setTimeout(5000)
    .onAbort((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .notFound((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .text((html) => {
      let imageEls = parseEHentaiThumbLinks(html);
      if (imageEls.length > 0) {
        let imageCount = 0;
        let images = Array<string>();
        for (let i = 0; i < imageEls.length; i++) {
          const image = imageEls[i]
          wretch(image.getAttribute("href"))
            .get()
            .setTimeout(5000)
            .onAbort((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .notFound((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .text((html) => {
              imageCount++;
              let contentURL = html.match("<img id=\"img\" src=\"(.*?)\"");
              if (contentURL != null) {
                images.push(contentURL[1]);
              }
              if (imageCount == imageEls.length) {
                helpers.next = helpers.next + 1;
                helpers.count = helpers.count + filterPathsToJustPlayable(IF.any, images, true).length;
                pm({
                  data: filterPathsToJustPlayable(filter, images, true),
                  allURLs: allURLs,
                  allPosts: allPosts,
                  weight: weight,
                  helpers: helpers,
                  source: source,
                  timeout: timeout,
                }, resolve);
              }
            })
        }
      } else {
        helpers.next = null;
        pm({
          data: [],
          allURLs: allURLs,
          allPosts: allPosts,
          weight: weight,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve);
      }
    });
}

export const loadLuscious = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 5000;
  const url = source.url;
  if (url.includes("albums")) {
    const name = getFileGroup(url);
    const id = name.substring(name.indexOf("_") + 1, name.length);
    wretch("https://members.luscious.net/graphql/nobatch/?operationName=PictureListInsideAlbum")
      .json({
        "operationName": "AlbumListOwnPictures",
        "query": "\n" +
          "query PictureListInsideAlbum($input: PictureListInput!) {\n" +
          "  picture {\n" +
          "    list(input: $input) {\n" +
          "      info {\n" +
          "        ...FacetCollectionInfo\n" +
          "      }\n" +
          "      items {\n" +
          "        __typename\n" +
          "        id\n" +
          "        title\n" +
          "        description\n" +
          "        created\n" +
          "        like_status\n" +
          "        number_of_comments\n" +
          "        number_of_favorites\n" +
          "        moderation_status\n" +
          "        width\n" +
          "        height\n" +
          "        resolution\n" +
          "        aspect_ratio\n" +
          "        url_to_original\n" +
          "        url_to_video\n" +
          "        is_animated\n" +
          "        position\n" +
          "        permissions\n" +
          "        url\n" +
          "        tags {\n" +
          "          category\n" +
          "          text\n" +
          "          url\n" +
          "        }\n" +
          "        thumbnails {\n" +
          "          width\n" +
          "          height\n" +
          "          size\n" +
          "          url\n" +
          "        }\n" +
          "      }\n" +
          "    }\n" +
          "  }\n" +
          "}\n" +
          "    \n" +
          "fragment FacetCollectionInfo on FacetCollectionInfo {\n" +
          "  page\n" +
          "  has_next_page\n" +
          "  has_previous_page\n" +
          "  total_items\n" +
          "  total_pages\n" +
          "  items_per_page\n" +
          "  url_complete\n" +
          "}\n",
        "variables": {
          "input": {
            "filters": [
              {
                "name": "album_id",
                "value": id,
              }
            ],
            "display": "position",
            "page": helpers.next + 1,
          }
        }
      })
      .post()
      .setTimeout(5000)
      .onAbort((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .notFound((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .json((json) => {
        const hasNextPage = json.data.picture.list.info.has_next_page;
        const items = json.data.picture.list.items;
        const totalItems = json.data.picture.list.info.total_items;
        if (items.length > 0) {
          const images = [];
          for (let item of items) {
            let width = 0;
            let url = null;
            for (let thumbnail of item.thumbnails) {
              if (thumbnail.width > width) {
                width = thumbnail.width;
                url = thumbnail.url;
              }
            }
            if (url != null) {
              images.push(url);
            }
          }
          helpers.next = hasNextPage ? helpers.next + 1 : null;
          helpers.count = totalItems;
          // If cdnio image server goes down, use this: filterPathsToJustPlayable(filter, images, true).map((s) => s.replace('cdnio.', 'w1680.')),
          pm({
            data: filterPathsToJustPlayable(filter, images, false),
            allURLs: allURLs,
            allPosts: allPosts,
            weight: weight,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        } else {
          helpers.next = null;
          pm({
            data: [],
            allURLs: allURLs,
            allPosts: allPosts,
            weight: weight,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        }
      })
      .catch((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve));
  } else {
    const id = getFileGroup(url);
    if (helpers.next == 0) {
      helpers.next = [0, 0, 0];
    }
    wretch("https://members.luscious.net/graphql/nobatch/?operationName=AlbumList")
      .json({
        "operationName": "AlbumList",
        "query": "query AlbumList($input: AlbumListInput!) {\n" +
          "album {\n" +
            "list(input: $input) {\n" +
              "info {...FacetCollectionInfo}\n" +
              "items {...AlbumMinimal}\n" +
            "}\n" +
          "}\n" +
        "}\n" +
        "fragment FacetCollectionInfo on FacetCollectionInfo {\n" +
          "page\n" +
          "has_next_page\n" +
          "has_previous_page\n" +
          "total_items\n" +
          "total_pages\n" +
          "url_complete\n" +
        "}\n" +
        "fragment AlbumMinimal on Album {\n" +
          "id\n" +
        "}",
        "variables": {
          "input": {
            "display": "date_newest",
            "filters": [
              {
                "name": "created_by_id",
                "value": id
              }
            ],
            "page": helpers.next[0] + 1,
          }
        }
      })
      .post()
      .setTimeout(5000)
      .onAbort((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .notFound((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .json((json) => {
        const userHasNextPage = json.data.album.list.info.has_next_page;
        const albums = json.data.album.list.items;
        if (albums.length > 0) {
          const album = albums[helpers.next[1]];
          wretch("https://members.luscious.net/graphql/nobatch/?operationName=AlbumListOwnPictures")
            .json({
              "operationName": "AlbumListOwnPictures",
              "query": "query AlbumListOwnPictures($input: PictureListInput!) {\n" +
                "picture {\n" +
                "list(input: $input) {\n" +
                "info {...FacetCollectionInfo}\n" +
                "items {...PictureStandardWithoutAlbum}\n" +
                "}\n" +
                "}\n" +
                "}\n" +
                "fragment FacetCollectionInfo on FacetCollectionInfo {\n" +
                "page\n" +
                "has_next_page\n" +
                "has_previous_page\n" +
                "total_items\n" +
                "total_pages\n" +
                "items_per_page\n" +
                "}\n" +
                "fragment PictureStandardWithoutAlbum on Picture {\n" +
                "url_to_original\n" +
                "url_to_video\n" +
                "url\n" +
                "}",
              "variables": {
                "input": {
                  "filters": [
                    {
                      "name": "album_id",
                      "value": album.id,
                    }
                  ],
                  "display": "rating_all_time",
                  "page": helpers.next[2] + 1,
                }
              }
            })
            .post()
            .setTimeout(5000)
            .onAbort((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .notFound((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .json((json) => {
              const hasNextPage = json.data.picture.list.info.has_next_page;
              if (hasNextPage) {
                helpers.next[2] = helpers.next[2] + 1;
              } else {
                if (helpers.next[1] < albums.length - 1) {
                  helpers.next[1] = helpers.next[1] + 1;
                  helpers.next[2] = 0;
                } else {
                  if (userHasNextPage) {
                    helpers.next[0] = helpers.next[0] + 1;
                    helpers.next[1] = 0;
                    helpers.next[2] = 0;
                  } else {
                    helpers.next = null;
                  }
                }
              }
              const items = json.data.picture.list.items;
              if (items.length > 0) {
                const images = [];
                for (let item of items) {
                  images.push(item.url_to_original);
                }
                helpers.count = helpers.count + filterPathsToJustPlayable(IF.any, images, true).length;
                pm({
                  data: filterPathsToJustPlayable(filter, images, true),
                  allURLs: allURLs,
                  allPosts: allPosts,
                  weight: weight,
                  helpers: helpers,
                  source: source,
                  timeout: timeout,
                }, resolve);
              } else {
                pm({
                  data: [],
                  allURLs: allURLs,
                  allPosts: allPosts,
                  weight: weight,
                  helpers: helpers,
                  source: source,
                  timeout: timeout,
                }, resolve);
              }
            })
            .catch((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve));
        } else {
          helpers.next = null;
          pm({
            warning: json,
            data: [],
            allURLs: allURLs,
            allPosts: allPosts,
            weight: weight,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        }
      })
      .catch((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve));
  }
}

export const loadBDSMlr = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  let url = source.url;
  if (url.endsWith("/rss")) {
    url = url.substring(0, url.indexOf("/rss"))
  }
  const retry = () => {
    if (helpers.retries < 3) {
      helpers.retries += 1;
      pm({
        data: [],
        allURLs: allURLs,
        allPosts: allPosts,
        weight: weight,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve);
    } else {
      pm({
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve);
    }
  }
  wretch(url + "/rss?page=" + (helpers.next + 1))
    .get()
    .setTimeout(5000)
    .onAbort(retry)
    .notFound((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .internalError(retry)
    .text((html) => {
      helpers.retries = 0;
      let itemEls = parseBDSMlrDescriptionImages(html);
      if (itemEls.length > 0) {
        let imageCount = 0;
        let images = Array<string>();
        for (let item of itemEls) {
          imageCount++;
          images.push(item.getAttribute("src"));
        }
        helpers.next = helpers.next + 1;
        helpers.count = helpers.count + filterPathsToJustPlayable(IF.any, images, true).length;
        pm({
          data: filterPathsToJustPlayable(filter, images, true),
          allURLs: allURLs,
          allPosts: allPosts,
          weight: weight,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve);
      } else {
        helpers.next = null;
        pm({
          data: [],
          allURLs: allURLs,
          allPosts: allPosts,
          weight: weight,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve);
      }
    });
}

let piwigoLoggedIn: boolean = false;
let piwigoAlerted: boolean = false;
export const loadPiwigo = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  let url = source.url;

  const user = config.remoteSettings.piwigoUsername;
  const pass = config.remoteSettings.piwigoPassword;
  const host = config.remoteSettings.piwigoHost;
  const protocol = config.remoteSettings.piwigoProtocol;
  const configured = host != "" && protocol != "" && user != "" && pass != "";

  if (configured) {
    const login = () => {
      return wretch(protocol + "://" + host + "/ws.php?format=json")
        .formUrl({method: "pwg.session.login", username: user, password: pass})
        .post()
        .setTimeout(5000)
        .notFound((e) => pm({
          error: e.message,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve))
        .internalError((e) => pm({
          error: e.message,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve))
        .json((json) => {
          if (json.stat == "ok") {
            piwigoLoggedIn = true;
            search();
          } else {
            pm({
              error: "Piwigo login failed.",
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve);
          }
        })
        .catch((e) => {
          pm({
            error: e.message,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        });
    }

    const retry = () => {
      if (helpers.retries < 3) {
        helpers.retries += 1;
        pm({
          data: [],
          allURLs: allURLs,
          allPosts: allPosts,
          weight: weight,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve);
      } else {
        pm({
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve);
      }
    }

    const search = () => {
      return wretch(url + "&page=" + helpers.next)
        .get()
        .setTimeout(5000)
        .onAbort(retry)
        .notFound((e) => pm({
          error: e.message,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve))
        .internalError(retry)
        .json((json) => {
          if (json.stat != "ok") {
            helpers.next = null;
            pm({
              data: [],
              allURLs: allURLs,
              allPosts: allPosts,
              weight: weight,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve);
            return;
          }

          const images = Array<string>();
          if (json?.result?.images) {
            for (let o = 0; o < json.result.images.length; o++) {
              const image = json.result.images[o];
              if (image.element_url) {
                images.push(image.element_url);
              }
            }
          }

          if (images.length > 0) {
            helpers.next = helpers.next + 1;
            helpers.count = helpers.count + filterPathsToJustPlayable(IF.any, images, true).length;
          } else {
            helpers.next = null;
          }

          pm({
            data: filterPathsToJustPlayable(filter, images, true),
            allURLs: allURLs,
            allPosts: allPosts,
            weight: weight,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        });
    };

    if (!piwigoLoggedIn) {
      login()
    } else {
      search();
    }
  } else {
    let systemMessage = undefined;
    if (!piwigoAlerted) {
      systemMessage = "You haven't configured FlipFlip to work with Piwigo yet.\nVisit Settings to configure Piwigo.";
      piwigoAlerted = true;
    }
    pm({
      systemMessage: systemMessage,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve);
  }
}

let hydrusAlerted: boolean = false;
export const loadHydrus = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const chunk = 1000;
  const apiKey = config.remoteSettings.hydrusAPIKey;
  const configured = apiKey != "";
  if (configured) {
    const protocol = config.remoteSettings.hydrusProtocol;
    const domain = config.remoteSettings.hydrusDomain;
    const port = config.remoteSettings.hydrusPort;
    const hydrusURL = protocol + "://" + domain + ":" + port;

    if (!source.url.startsWith(hydrusURL)) {
      let systemMessage = undefined;
      if (!hydrusAlerted) {
        systemMessage = "Source url '" + source.url + "' does not match configured Hydrus server '" + hydrusURL;
        hydrusAlerted = true;
      }
      pm({
        systemMessage: systemMessage,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve);
      return;
    }

    const tagsRegex = /tags=([^&]*)&?.*$/.exec(source.url);
    let noTags = tagsRegex == null || tagsRegex.length <= 1;

    let pages = 0;
    const search = () => {
      const url = noTags ? hydrusURL + "/get_files/search_files" : hydrusURL + "/get_files/search_files?tags=" + tagsRegex[1];
      wretch(url)
        .headers({"Hydrus-Client-API-Access-Key": apiKey})
        .get()
        .setTimeout(15000)
        .notFound((e) => {
          pm({
            error: e.message,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        })
        .internalError((e) => {
          pm({
            error: e.message,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        })
        .json((json) => {
          const fileIDs = json.file_ids;
          pages = Math.ceil(fileIDs.length / chunk);
          getFileMetadata(fileIDs, 0);
        })
        .catch((e) => pm({
          error: e.message,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve));
    }

    let images = Array<string>();
    const getFileMetadata = (fileIDs: Array<number>, page: number) => {
      const pageIDs = fileIDs.slice(page*chunk, (page+1)*chunk);
      wretch(hydrusURL + "/get_files/file_metadata?file_ids=[" + pageIDs.toString() + "]")
        .headers({"Hydrus-Client-API-Access-Key": apiKey})
        .get()
        .setTimeout(15000)
        .notFound((e) => {
          pm({
            error: e.message,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        })
        .internalError((e) => {
          pm({
            error: e.message,
            helpers: helpers,
            source: source,
            timeout: timeout,
          }, resolve);
        })
        .json((json) => {
          for (let metadata of json.metadata) {
            if ((filter == IF.any && isImageOrVideo(metadata.ext, true)) ||
              (filter == IF.stills || filter == IF.images) && isImage(metadata.ext, true) ||
              (filter == IF.animated && metadata.ext.toLowerCase().endsWith('.gif') || isVideo(metadata.ext, true)) ||
              (filter == IF.videos && isVideo(metadata.ext, true))) {
              images.push(hydrusURL + "/get_files/file?file_id=" + metadata.file_id + "&Hydrus-Client-API-Access-Key=" + apiKey + "&ext=" + metadata.ext);
            }
          }

          page += 1;
          if (page == pages) {
            pm({
              data: images,
              allURLs: allURLs,
              allPosts: allPosts,
              weight: weight,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve);
          } else {
            getFileMetadata(fileIDs, page);
          }
        })
        .catch((e) => pm({
          error: e.message,
          helpers: helpers,
          source: source,
          timeout: timeout,
        }, resolve));
    }

    search();
  } else {
    let systemMessage = undefined;
    if (!hydrusAlerted) {
      systemMessage = "You haven't configured FlipFlip to work with Hydrus yet.\nVisit Settings to configure Hydrus.";
      hydrusAlerted = true;
    }
    pm({
      systemMessage: systemMessage,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve);
  }
}
