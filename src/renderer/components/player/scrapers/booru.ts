import wretch from "wretch";
import {DOMParser} from "@xmldom/xmldom";

import {IF, ST} from "../../../data/const";
import Config from "../../../data/Config";
import LibrarySource from "../../../data/LibrarySource";
import { pm, processAllURLs, filterPathsToJustPlayable, getSourceType, getFileGroup, getFileName } from "../Scrapers";

// Ported from Flip-Electron src/renderer/components/player/Scrapers.ts
// Electron-only dependency neutralized:
// - domino.createWindow(html).document.querySelectorAll("span.thumb > a") has no
//   @xmldom/xmldom equivalent (that lib implements no querySelectorAll), so it is
//   replaced with parseThumbLinks() below using manual DOM traversal.

// @xmldom/xmldom implements no querySelectorAll, so emulate `span.thumb > a` via traversal.
const parseThumbLinks = (html: string): Array<any> => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [];
  const anchors = doc.getElementsByTagName("a");
  for (let i = 0; i < anchors.length; i++) {
    const parent = anchors.item(i).parentNode as any;
    if (parent && parent.nodeName.toLowerCase() === "span" && ((parent.getAttribute("class") || "").split(/\s+/).includes("thumb"))) {
      links.push(anchors.item(i));
    }
  }
  return links;
};

export const loadE621 = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const hostRegex = /^(https?:\/\/[^\/]*)\//g;
  const thisHost = hostRegex.exec(url)[1];
  let suffix = "";
  if (url.includes("/pools/")) {
    suffix = "/pools.json?search[id]=" + url.substring(url.lastIndexOf("/") + 1);

    wretch(thisHost + suffix)
      .get()
      .setTimeout(5000)
      .badRequest((e) => pm({
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
      .timeout((e) => pm({
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
      .onAbort((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .json((json: any) => {
        if (json.length == 0) {
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

        const count = json[0].post_count;
        const images = Array<string>();
        for (let postID of json[0].post_ids) {
          suffix = "/posts/" + postID + ".json";
          wretch(thisHost + suffix)
            .get()
            .setTimeout(5000)
            .badRequest((e) => pm({
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
            .timeout((e) => pm({
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
            .onAbort((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .json((json: any) => {
              if (json.post && json.post.file.url) {
                let fileURL = json.post.file.url;
                if (!fileURL.startsWith("http")) {
                  fileURL = "https://" + fileURL;
                }
                images.push(fileURL);
              }

              if (images.length == count) {
                helpers.next = null;
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
            .catch((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve));
        }
      })
      .catch((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve));
  } else {
    suffix = "/posts.json?limit=20&page=" + (helpers.next + 1);
    const tagRegex = /[?&]tags=([^&]*)/g;
    let tags;
    if ((tags = tagRegex.exec(url)) !== null) {
      suffix += "&tags=" + tags[1];
    }

    wretch(thisHost + suffix)
      .get()
      .setTimeout(5000)
      .badRequest((e) => pm({
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
      .timeout((e) => pm({
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
      .onAbort((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve))
      .json((json: any) => {
        if (json.length == 0) {
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

        let list = json.posts;
        const images = Array<string>();
        for (let p of list) {
          if (p.file.url) {
            let fileURL = p.file.url;
            if (!fileURL.startsWith("http")) {
              fileURL = "https://" + fileURL;
            }
            images.push(fileURL);
          }
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
      })
      .catch((e) => pm({
        error: e.message,
        helpers: helpers,
        source: source,
        timeout: timeout,
      }, resolve));
  }
}

export const loadDanbooru = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const hostRegex = /^(https?:\/\/[^\/]*)\//g;
  const thisHost = hostRegex.exec(url)[1];
  let suffix = "";
  if (url.includes("/pools/")) {
    suffix = "/pools/" + url.substring(url.lastIndexOf("/") + 1) + ".json";
  } else if (url.includes("favorite_groups")) {
    suffix = "/favorite_groups/" + url.substring(url.lastIndexOf("/") + 1) + ".json";
  } else {
    suffix = "/post/index.json?limit=20&page=" + (helpers.next + 1);
    const tagRegex = /[?&]tags=([^&]*)/g;
    let tags;
    if ((tags = tagRegex.exec(url)) !== null) {
      suffix += "&tags=" + tags[1];
    }
    const titleRegex = /[?&]title=(.*)&?/g;
    let title;
    if ((title = titleRegex.exec(url)) !== null) {
      if (tags == null) {
        suffix += "&tags=";
      } else if (!suffix.endsWith("+")) {
        suffix += "+";
      }
      suffix += title[1];
    }
  }
  wretch(thisHost + suffix)
    .get()
    .setTimeout(5000)
    .badRequest((e) => pm({
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
    .timeout((e) => pm({
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
    .onAbort((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .json((json: any) => {
      if (json.length == 0) {
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

      if (json.post_ids) {
        if (json.post_ids.length == 0) {
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
        const postIDs = json.post_ids;
        const limit = 10;
        let current = helpers.next;
        const getPost = () => {
          wretch(thisHost + "/posts/" + postIDs[current++] + ".json")
            .get()
            .setTimeout(5000)
            .badRequest((e) => pm({
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
            .timeout((e) => pm({
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
            .onAbort((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .json((json: any) => {
              images.push(json.file_url);
              if (images.length == limit || postIDs.length == current) {
                if (postIDs.length == current) {
                  helpers.next = null;
                } else {
                  helpers.next = current;
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
                setTimeout(getPost, 200);
              }
            })
            .catch((e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve));
        }
        setTimeout(getPost, 200);
      } else {
        const images = Array<string>();
        for (let p of json) {
          if (p.file_url) {
            let fileURL = p.file_url;
            if (!p.file_url.startsWith("http")) {
              fileURL = "https://" + p.file_url;
            }
            images.push(fileURL);
          }
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
      }
    })
    .catch((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve));
}

export const loadBooruScrape = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const hostRegex = /^(https?:\/\/[^\/]*)\//g;
  const thisHost = hostRegex.exec(url)[1];
  wretch(url + "&pid=" + (helpers.next * 10))
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
    .error(503, (e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .text((html) => {
      let imageEls = parseThumbLinks(html);
      if (imageEls.length > 0) {
        let imageCount = 0;
        let images = Array<string>();

        const getImage = (index: number) => {
          let link = imageEls[index].getAttribute("href");
          if (!link.startsWith("http")) {
            link = thisHost + "/" + link;
          }
          wretch(link)
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
            .error(503, (e) => pm({
              error: e.message,
              helpers: helpers,
              source: source,
              timeout: timeout,
            }, resolve))
            .text((html) => {
              imageCount++;
              let contentURL = html.match("<img[^>]*id=\"?image\"?[^>]*src=\"([^\"]*)\"");
              if (contentURL != null) {
                let url = contentURL[1];
                if (url.startsWith("//")) url = "http:" + url;
                images.push(url);
              }
              contentURL = html.match("<img[^>]*src=\"([^\"]*)\"[^>]*id=\"?image\"?");
              if (contentURL != null) {
                let url = contentURL[1];
                if (url.startsWith("//")) url = "http:" + url;
                images.push(url);
              }
              contentURL = html.match("<video[^>]*src=\"([^\"]*)\"");
              if (contentURL != null) {
                let url = contentURL[1];
                if (url.startsWith("//")) url = "http:" + url;
                images.push(url);
              }
              if (imageCount == imageEls.length || imageCount == 10) {
                helpers.next = helpers.next + 1;
                helpers.count = helpers.count + filterPathsToJustPlayable(IF.any, images, false).length;
                pm({
                  data: filterPathsToJustPlayable(filter, images, false),
                  allURLs: allURLs,
                  allPosts: allPosts,
                  weight: weight,
                  helpers: helpers,
                  source: source,
                  timeout: timeout,
                }, resolve);
              }
            });

          if (index < imageEls.length - 1 && index < 9) {
            setTimeout(getImage.bind(null, index+1), 1000);
          }
        };

        setTimeout(getImage.bind(null, 0), 1000);
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

export const loadBooruAPI = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const hostRegex = /^(https?:\/\/[^\/]*)\//g;
  const thisHost = hostRegex.exec(url)[1];
  let suffix = "/index.php?page=dapi&s=post&q=index&limit=20&json=1&pid=" + (helpers.next + 1);
  const tagRegex = /[?&]tags=([^&]*)/g;
  let tags;
  if ((tags = tagRegex.exec(url)) !== null) {
    suffix += "&tags=" + tags[1];
  }
  wretch(thisHost + suffix)
    .get()
    .setTimeout(5000)
    .badRequest((e) => pm({
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
    .timeout((e) => pm({
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
    .onAbort((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .json((json: any) => {
      if (json.length == 0) {
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

      const images = Array<string>();
      for (let p of json) {
        if (p.file_url) {
          images.push(p.file_url);
        } else if (p.image) {
          images.push(thisHost + "//images/" + p.directory + "/" + p.image);
        }
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
    })
    .catch((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve));
}

export const loadGelbooru = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const thisHost = "https://gelbooru.com";
  let suffix = "/index.php?page=dapi&s=post&q=index&limit=20&json=1&pid=" + (helpers.next + 1) + "&api_key=" + config.remoteSettings.gelbooruAPIKey + "&user_id=" + config.remoteSettings.gelbooruUserID;
  const tagRegex = /[?&]tags=([^&]*)/g;
  let tags;
  if ((tags = tagRegex.exec(url)) !== null) {
    suffix += "&tags=" + tags[1];
  }
  pm({warning: thisHost + suffix});
  wretch(thisHost + suffix)
    .get()
    .setTimeout(5000)
    .badRequest((e) => pm({
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
    .timeout((e) => pm({
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
    .onAbort((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .json((json: any) => {
      pm({warning: json});

      if (json.post.length == 0) {
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

      const images = Array<string>();
      for (let p of json.post) {
        if (p.file_url) {
          images.push(p.file_url);
          wretch(p.file_url).get();
        } else if (p.image) {
          images.push("https://img2.gelbooru.com//images/" + p.directory + "/" + p.image);
        }
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
    })
    .catch((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve));
}

export const loadRule34 = (allURLs: Map<string, Array<string>>, allPosts: Map<string, string>, config: Config, source: LibrarySource, filter: string, weight: string, helpers: {next: any, count: number, retries: number, uuid: string}, resolve?: Function) => {
  const timeout = 8000;
  const url = source.url;
  const thisHost = "https://api.rule34.xxx";
  let suffix = "/index.php?page=dapi&s=post&q=index&limit=20&json=1&pid=" + (helpers.next) + "&api_key=" + config.remoteSettings.rule34APIKey + "&user_id=" + config.remoteSettings.rule34UserID;
  const tagRegex = /[?&]tags=([^&]*)/g;
  let tags;
  if ((tags = tagRegex.exec(url)) !== null) {
    suffix += "&tags=" + tags[1];
  }
  pm({warning: thisHost + suffix});
  wretch(thisHost + suffix)
    .get()
    .setTimeout(5000)
    .badRequest((e) => pm({
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
    .timeout((e) => pm({
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
    .onAbort((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve))
    .json((json: any) => {
      if (json.length == 0) {
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

      const images = Array<string>();
      for (let p of json) {
        if (p.file_url) {
          images.push(p.file_url);
        } else if (p.image) {
          images.push(thisHost + "//images/" + p.directory + "/" + p.image);
        }
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
    })
    .catch((e) => pm({
      error: e.message,
      helpers: helpers,
      source: source,
      timeout: timeout,
    }, resolve));
}
