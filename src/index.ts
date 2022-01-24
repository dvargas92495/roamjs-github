import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import genericError from "roamjs-components/dom/genericError";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import type { RoamBlock } from "roamjs-components/types";
import createBlock from "roamjs-components/writes/createBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import axios from "axios";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import getPageTitleByHtmlElement from "roamjs-components/dom/getPageTitleByHtmlElement";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";

const ID = "github";
const CONFIG = toConfigPageName(ID);

const getButtonConfig = (target: HTMLButtonElement, targetCommand: string) => {
  const rawParts = target.innerText
    .substring(targetCommand.length + 1)
    .split(" ");
  let quotedWord = "";
  const restOfButtonText = [];
  for (const part of rawParts) {
    if (quotedWord) {
      if (part.endsWith('"')) {
        restOfButtonText.push(
          `${quotedWord} ${part.substring(0, part.length - 1)}`
        );
        quotedWord = "";
      } else {
        quotedWord = `${quotedWord} ${part}`;
      }
    } else {
      if (part.startsWith('"')) {
        quotedWord = part.substring(1);
      } else {
        restOfButtonText.push(part);
      }
    }
  }
  const numPairs = Math.floor(restOfButtonText.length / 2);
  const buttonConfig: Record<string, string> = {};
  for (let i = 0; i < numPairs; i++) {
    buttonConfig[restOfButtonText[i * 2]] = restOfButtonText[i * 2 + 1];
  }
  return buttonConfig;
};

const clickEventListener =
  (
    targetCommand: string,
    callback: (c: Record<string, string>, u: string) => void
  ) =>
  (e: MouseEvent) => {
    const htmlTarget = e.target as HTMLElement;
    if (
      htmlTarget &&
      htmlTarget.tagName === "BUTTON" &&
      htmlTarget.innerText
        .toUpperCase()
        .trim()
        .startsWith(targetCommand.toUpperCase())
    ) {
      const target = htmlTarget;
      const buttonConfig = getButtonConfig(
        target as HTMLButtonElement,
        targetCommand
      );
      const { blockUid } = exports.getUidsFromButton(target);
      window.roamAlphaAPI.updateBlock({ block: { uid: blockUid, string: "" } });
      callback(buttonConfig, blockUid);
    }
  };

const addButtonListener = (
  shortcut: string,
  callback: (a: Record<string, string>, u: string) => void
) => {
  document.addEventListener("click", clickEventListener(shortcut, callback));
};

runExtension(ID, async () => {
  const { pageUid } = await createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              title: "username",
              description: "The GitHub username to focus on",
              type: "text",
            },
            {
              title: "token",
              description: "The GitHub token to use during quering",
              type: "text",
            },
          ],
        },
      ],
    },
  });

  const pushBullets = (
    bullets: string[],
    blockUid: string,
    parentUid: string
  ) => {
    return updateBlock({ uid: blockUid, text: bullets[0] }).then(() => {
      const order = getOrderByBlockUid(blockUid);
      return Promise.all(
        bullets
          .slice(1)
          .map((text, i) =>
            createBlock({ parentUid, order: order + i + 1, node: { text } })
          )
      );
    });
  };

  const importGithubIssues = async (
    _: {
      [key: string]: string;
    },
    blockUid: string
  ) => {
    const parentUid = getParentUidByBlockUid(blockUid);
    const config = getBasicTreeByParentUid(pageUid);
    const username = getSettingValueFromTree({ tree: config, key: "username" });
    if (!username) {
      updateBlock({
        uid: blockUid,
        text: "Error: Missing required parameter username!",
      });
      return;
    }
    const token = getSettingValueFromTree({ tree: config, key: "token" });
    const githubReq = token
      ? axios.get(`https://api.github.com/issues`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${username}:${token}`
            ).toString("base64")}`,
          },
        })
      : axios.get(`${process.env.API_URL}/github-issues?username=${username}`);
    githubReq
      .then(async (r) => {
        const issues = r.data;
        if (issues.length === 0) {
          updateBlock({ uid: blockUid, text: "No issues assigned to you!" });
          return;
        }
        const bullets = issues.map(
          (i: { title: string; html_url: string }) =>
            `[${i.title}](${i.html_url})`
        ) as string[];
        await pushBullets(bullets, blockUid, parentUid);
      })
      .catch(genericError);
  };

  const importGithubRepos = async (
    buttonConfig: { [key: string]: string },
    blockUid: string
  ) => {
    const parentUid = getParentUidByBlockUid(blockUid);
    const config = getBasicTreeByParentUid(pageUid);
    const configUsername = getSettingValueFromTree({
      tree: config,
      key: "username",
    });
    const username = buttonConfig.FOR ? buttonConfig.FOR : configUsername;
    if (!username) {
      updateBlock({
        uid: blockUid,
        text: "Error: Missing required parameter username!",
      });
      return;
    }
    const token = getSettingValueFromTree({ tree: config, key: "token" });
    const githubReq = token
      ? axios.get(`https://api.github.com/users/${username}/repos`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${configUsername}:${token}`
            ).toString("base64")}`,
          },
        })
      : axios.get(
          `${process.env.API_URL}/github-repositories?username=${username}`
        );
    githubReq
      .then(async (r) => {
        const repos = r.data;
        if (repos.length === 0) {
          updateBlock({
            uid: blockUid,
            text: `No repos in ${username}'s account!`,
          });
          return;
        }
        const bullets = repos.map((i: { name: string }) => `[[${i.name}]]`);
        await pushBullets(bullets, blockUid, parentUid);
      })
      .catch(genericError);
  };

  const importGithubProjects = async (
    buttonConfig: {
      [key: string]: string;
    },
    blockUid: string
  ) => {
    const parentUid = getParentUidByBlockUid(blockUid);
    const config = getBasicTreeByParentUid(pageUid);
    const configUsername = getSettingValueFromTree({
      tree: config,
      key: "username",
    });
    const username = buttonConfig.FOR ? buttonConfig.FOR : configUsername;
    const pageTitle = getPageTitleByHtmlElement(document.activeElement);
    const repoName = buttonConfig.IN ? buttonConfig.IN : pageTitle.textContent;
    const repository = `${username}/${repoName}`;
    const token = getSettingValueFromTree({ tree: config, key: "token" });
    const githubReq = token
      ? axios.get(`https://api.github.com/repos/${repository}/projects`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${configUsername}:${token}`
            ).toString("base64")}`,
            Accept: "application/vnd.github.inertia-preview+json",
          },
        })
      : axios.get(
          `${process.env.API_URL}/github-projects?repository=${repository}`
        );
    githubReq
      .then(async (r) => {
        const projects = r.data;
        if (projects.length === 0) {
          updateBlock({ uid: blockUid, text: `No projects in ${repository}` });
          return;
        }
        const bullets = projects.map((i: { name: string }) => `[[${i.name}]]`);
        await pushBullets(bullets, blockUid, parentUid);
      })
      .catch(genericError);
  };

  const importGithubCards = async (
    buttonConfig: { [key: string]: string },
    blockUid: string
  ) => {
    const parentUid = getParentUidByBlockUid(blockUid);
    const config = getBasicTreeByParentUid(pageUid);
    const configUsername = getSettingValueFromTree({
      tree: config,
      key: "username",
    });
    const token = getSettingValueFromTree({
      tree: config,
      key: "token",
    });
    const pageTitle = getPageTitleByHtmlElement(document.activeElement);
    const parentBlocks = window.roamAlphaAPI
      .q(
        `[:find (pull ?parentPage [:node/title]) :where [?parentPage :block/children ?referencingBlock] [?referencingBlock :block/refs ?referencedPage] [?referencedPage :node/title "${pageTitle.textContent}"]]`
      )
      .filter((block) => block.length) as RoamBlock[][];
    const repoAsParent =
      parentBlocks.length > 0 ? parentBlocks[0][0]?.title : "";

    const username = buttonConfig.FOR ? buttonConfig.FOR : configUsername;
    const repoName = buttonConfig.IN ? buttonConfig.IN : repoAsParent;
    const repository = `${username}/${repoName}`;
    const project = buttonConfig.UNDER
      ? buttonConfig.UNDER
      : pageTitle.textContent;
    const column = buttonConfig.AS ? buttonConfig.AS : "To do";

    if (!token) {
      axios
        .get(
          `${process.env.API_URL}/github-cards?repository=${repository}&project=${project}&column=${column}`
        )
        .then(async (r) => {
          const cards = r.data;
          if (cards.length === 0) {
            updateBlock({ uid: blockUid, text: `No cards in ${repository}` });
            return;
          }
          const bullets = cards.map(
            (i: { note: string; content_url: string; html_url: string }) =>
              `[${
                i.note
                  ? i.note
                  : i.content_url.substring(
                      "https://api.github.com/repos/".length
                    )
              }](${i.html_url})`
          );
          await pushBullets(bullets, blockUid, parentUid);
        })
        .catch(genericError);
    } else {
      updateBlock({
        uid: blockUid,
        text: "Personal Token currently not supported for cards",
      });
    }
  };
  addButtonListener("Import Github Cards", importGithubCards);
  addButtonListener("Import Github Issues", importGithubIssues);
  addButtonListener("Import Github Projects", importGithubProjects);
  addButtonListener("Import Github Repos", importGithubRepos);
});
