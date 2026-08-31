/**
 * The content script, injected only when the user clicks the toolbar button.
 *
 * The manifest declares no `content_scripts`, so nothing here runs on any page
 * until that click: the popup calls chrome.scripting.executeScript against the
 * activeTab. It reads the DOM that is already rendered and makes no request of
 * its own — nothing is fetched, nothing is crawled, nothing runs in the
 * background.
 */
import { extractFromPage } from "./adapters";

declare const chrome: {
  runtime: { sendMessage: (msg: unknown) => void };
};

try {
  chrome.runtime.sendMessage({
    type: "jobtracker:extracted",
    payload: extractFromPage(document, location.href),
  });
} catch (error) {
  chrome.runtime.sendMessage({
    type: "jobtracker:error",
    message: error instanceof Error ? error.message : "Could not read this page",
  });
}
